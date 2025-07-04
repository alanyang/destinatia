import OpenAI from "openai";
import events from "node:events";
import { z } from "zod";
import { v4 as uuid } from "uuid"
import { ChatCompletionMessageParam } from "openai/resources/index.mjs";
import { Tool, Context, toolModelSchema, defineTool } from "./tool";

import zodToJsonSchema from "zod-to-json-schema";
import { jsonSafeParse, normalizeName } from "./utils";
import { ChatCompletionTool } from "openai/resources/index";
import { createDefaultProvider, providerFactory } from "./provider";
import { CompressFunc, Memory } from "./memory";
import { PersistentHistoryFunction } from "./persisten";
import { createLogger } from "./logger";

export type LLMConfig = {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
};


export enum AgentEvent {
  Start = "start",
  Log = "log",
  Debug = "debug",
  Warn = "warn",
  Error = "error",
  ToolCallStart = "tool_call_start",
  ToolCallEnd = "tool_call_end",
  ToolCallError = "tool_call_error",
  LLMCallStart = "llm_call_start",
  LLMCallEnd = "llm_call_end",
  MessageCompressed = "message_compressed",
  Completed = "completed",
  Aborted = "aborted",
  StatsUpdate = "stats_update",
}


export type ExecutionStats = {
  totalTokens: number;
  llmCalls: number;
  toolCalls: number;
  toolCallsCompleted?: number;
  toolCallsFailed?: number;
  duration: number;
  errors: Error[];
  compressedMessages: number;
  currentStep?: number;
  status?: "running" | "completed" | "failed" | "aborted";
};

export type AgentArgs = {
  createProvider?: providerFactory;
  name: string;
  instructions: string;
  description?: string;
  tools?: Tool<any, any>[];
  outputSchema?: z.ZodObject<any>;
  inputSchema?: z.ZodObject<any>;
  maxTurns?: number;
  verbose?: boolean;
  enableMessageCompression?: boolean;
  compression?: CompressFunc;
  maxMessageHistory?: number;
  defaultLLMConfig?: LLMConfig;
  persistentHistory?: PersistentHistoryFunction;
};

export type ExecutorArgs = {
  input: string | Record<string, unknown>;
  messages?: ChatCompletionMessageParam[];
  step?: number;
  ctx?: Context;
  llmConfig?: LLMConfig;
  signal?: AbortSignal;
  from?: Memory
  resetMemory?: boolean
};

const MAX_AGENT_STEPS = 65535;

export function createAgent({
  name,
  instructions,
  description,
  outputSchema,
  inputSchema,
  createProvider = createDefaultProvider,
  tools = [],
  maxTurns = 88,
  verbose = false,
  defaultLLMConfig = {},
  compression,
  persistentHistory,
}: AgentArgs) {

  const id = uuid()

  if (maxTurns > MAX_AGENT_STEPS) {
    maxTurns = MAX_AGENT_STEPS
  }

  const event = new events.EventEmitter();
  let stats: ExecutionStats = {
    totalTokens: 0,
    llmCalls: 0,
    toolCalls: 0,
    toolCallsCompleted: 0,
    toolCallsFailed: 0,
    duration: Date.now(),
    errors: [],
    compressedMessages: 0,
    currentStep: 0,
    status: 'running',
  }

  const logger = createLogger({ name })

  const debug = (obj: unknown) => {
    event.emit(AgentEvent.Log, obj);
    if (verbose) logger.debug(obj);
  }

  const log = (obj: unknown) => {
    event.emit(AgentEvent.Log, obj);
    if (verbose) logger.info(obj);
  };

  const warn = (obj: unknown) => {
    event.emit(AgentEvent.Warn, obj);
    if (verbose) logger.warn(obj);
  };

  const error = (err: Error | string) => {
    event.emit(AgentEvent.Error, err);
    if (verbose) logger.error(err);
  };

  const validateTools = () => {
    if (!tools.every(v => !!v.name)) {
      throw "Tools must have a name"
    }

    const names = new Set(tools.map(v => v.name))
    if (names.size !== tools.length) {
      throw `Duplicate name in ${tools.map(v => v.name).join(",")}`
    }

    if (!tools.every(v => typeof v.handler === "function")) {
      throw `Tools must have a handler function`
    }
  };

  validateTools();

  const { llm, model, format = "text" } = createProvider();

  const applyMiddleware = async (
    tool: Tool<z.ZodObject<any>, z.ZodTypeAny>,
    args: z.ZodTypeAny,
    ctx?: Context
  ): Promise<any> => {
    if (!tool.middlewares || tool.middlewares.length === 0) {
      if (tool.validators?.args) {
        const typedArgs: z.infer<typeof tool.validators.args> = args as any;
        return tool.handler(typedArgs, ctx);
      } else {
        return tool.handler(args, ctx)
      }
    }

    let index = 0;
    const next = async (modifiedArgs: z.ZodTypeAny): Promise<any> => {
      if (index >= tool.middlewares!.length) {
        return tool.handler(modifiedArgs, ctx);
      }

      const middleware = tool.middlewares![index++];
      return middleware(modifiedArgs, next, ctx);
    };

    return next(args);
  };

  const executeToolCall = async (
    toolCall: any,
    ctx?: Context,
    signal?: AbortSignal
  ) => {
    const name = toolCall.function.name;
    const tool = tools.find(v => v.name === name);

    if (!tool) {
      warn(`[AgentExecutor] 🚫 Error: LLM requested unknown tool: ${name}`);
      return {
        tool_call_id: toolCall.id,
        role: 'tool' as const,
        name: name,
        content: `Error: Unknown tool ${name}`,
      };
    }

    event.emit(AgentEvent.ToolCallStart, { name, args: toolCall.function.arguments });

    try {
      if (signal?.aborted) {
        throw new Error('Execution aborted');
      }

      const functionArgs = JSON.parse(toolCall.function.arguments || '{}');

      const timeoutPromise = tool.timeout
        ? new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Tool execution timeout')), tool.timeout)
        )
        : null;

      const executionPromise = Promise.resolve(applyMiddleware(tool, functionArgs, ctx));

      const result = timeoutPromise
        ? await Promise.race([executionPromise, timeoutPromise])
        : await executionPromise;

      event.emit(AgentEvent.ToolCallEnd, { name, result });
      log(`[AgentExecutor] ✨ Tool "${name}" executed successfully.`);

      event.emit(AgentEvent.StatsUpdate, {
        updates: { toolCallsCompleted: 1 },
        toolName: name,
      });

      return {
        tool_call_id: toolCall.id,
        role: 'tool' as const,
        name: name,
        content: typeof result === 'object' && result !== null ? JSON.stringify(result) : String(result),
      };
    } catch (err) {
      event.emit(AgentEvent.ToolCallError, { name, error: err });
      error(`[AgentExecutor] ❌ Tool "${name}" execution failed: ${err}`);

      event.emit(AgentEvent.StatsUpdate, {
        updates: { toolCallsFailed: 1 },
        toolName: name,
        error: err,
      });

      return {
        tool_call_id: toolCall.id,
        role: 'tool' as const,
        name: name,
        content: `Error: ${(err as Error).message}`,
      };
    }
  };

  const memory: Memory = new Memory({ name, systemMessage: instructions, logger: logger.child({ name: `${name} memory` }) })

  memory.on("change", () => {
    logger.trace(memory.toString())
  })

  const toString = (): string => {
    return `Agent: [${id}]@${name}, ${memory.systemMessage}`
  }

  const run = async ({
    input,
    ctx,
    signal,
    from,
    step = 0,
    llmConfig = {},
    resetMemory = true,
  }: ExecutorArgs) => {

    if (from) {
      memory.handoff({ from })
    }

    if (resetMemory) {
      memory.reset()
    }

    const updateStats = (updates: Partial<ExecutionStats>) => {
      stats = { ...stats, ...updates }
      event.emit(AgentEvent.StatsUpdate, {
        current: { ...stats },
        updates,
        step,
      });
    }

    try {
      if (signal?.aborted) {
        event.emit(AgentEvent.Aborted);
        updateStats({ status: 'aborted' });
        throw new Error('Execution aborted');
      }

      if (step >= maxTurns) {
        warn(`[AgentExecutor] 🚫 Maximum execution steps reached. Task not completed.`);
        throw new Error(`Maximum execution steps (${maxTurns}) reached. Task not completed.`);
      }

      if (memory.size <= 1) {
        let jsonOutputInstruction = "";
        if (outputSchema) {
          jsonOutputInstruction += `Your final response MUST be a JSON object that strictly adheres to the following schema.\n`;
          jsonOutputInstruction += `You should only make tool calls if necessary to gather the information required to construct this JSON object.\n`;
          if (format === "text") {
            jsonOutputInstruction += `Please wrap the JSON object within a markdown code block, like this:\n\`\`\`json\n{ /* JSON content */ }\n\`\`\`\nDo not add any other conversational text or explanations outside the JSON block.\n`;
          }
          jsonOutputInstruction += `Final output JSON schema is: \n\`\`\`json${JSON.stringify(zodToJsonSchema(outputSchema, {}), null, 2)}\`\`\``;
        }

        const systemMessage = [
          instructions,
          description ?? "",
          jsonOutputInstruction
        ].filter(v => typeof v === 'string' && v.trim().length > 0).join("\n\n")

        const userMessage = typeof input === "string" ? input : "```json" + JSON.stringify(input, null, 2) + "```"
        memory.replaceSystemMessage(systemMessage)
        memory.add(
          { role: "user", content: userMessage }
        )
      } else {
        const rawMessagesLength = memory.size
        memory.arrange(compression);
        if (rawMessagesLength > memory.size) {
          updateStats({ compressedMessages: stats.compressedMessages + 1 });
        }
      }


      if (step === 0) {
        event.emit(AgentEvent.Start, { prompt: input, ctx });
        log(`[AgentExecutor] 🚀 Starting agent. User prompt: "${typeof input === 'object' ? JSON.stringify(input, null, 2) : input}"`);
        updateStats({ status: 'running', currentStep: step });
      } else {
        log(`[AgentExecutor] 🔄 Start Cycle ${step}`);
        updateStats({ currentStep: step });
      }

      const mergedLLMConfig = {
        temperature: 0.1,
        frequency_penalty: 1,
        presence_penalty: 1,
        ...defaultLLMConfig,
        ...llmConfig,
      };

      event.emit(AgentEvent.LLMCallStart, { step, messageCount: memory.size });

      let response: OpenAI.Chat.Completions.ChatCompletion;
      try {
        const toolOptions = !!tools?.length ?
          {
            tools: tools.map(v => toolModelSchema(v)) as ChatCompletionTool[],
            tool_choice: "auto" as const
          } : {}

        response = await llm.chat.completions.create({
          ...mergedLLMConfig,
          model,
          messages: memory.messages,
          ...toolOptions,
          response_format: { type: format }
        });
      } catch (llmError) {
        error(`[AgentExecutor] ❌ Step ${step}: LLM call failed:${llmError}`);
        updateStats({
          errors: [...stats.errors, llmError as Error],
          llmCalls: stats.llmCalls + 1
        });
        throw new Error(`LLM call failed: ${(llmError as Error).message}`);
      }

      const tokensUsed = response.usage?.total_tokens || 0;
      updateStats({
        llmCalls: stats.llmCalls + 1,
        totalTokens: stats.totalTokens + tokensUsed
      });

      event.emit(AgentEvent.LLMCallEnd, { step, usage: response.usage });

      const choice = response.choices?.at(0)
      if (!choice) {
        error(`[AgentExecutor] ❌ Step ${step}: No choices returned from LLM`);
        throw new Error("LLM returned no choices");
      }
      if (!choice.message) {
        error(`[AgentExecutor] ❌ Step ${step}: No message in LLM response`);
        throw new Error("LLM returned no message");
      }

      const responseMessage = choice.message;
      memory.add(responseMessage)

      if (persistentHistory) {
        try {
          await persistentHistory({
            messages: memory.messages,
            step,
            prompt: input,
            ctx,
            llmConfig,
          });
        } catch (persistError) {
          warn(`[AgentExecutor] ⚠️ Failed to persist messages ${persistError}`);
        }
      }


      const { tool_calls: toolCalls, content } = responseMessage

      if (content) {
        log(`[AgentExecutor] ✅ Step ${step}: LLM returned final content.Task completed.`);
        const finalDuration = Date.now() - stats.duration;
        updateStats({ duration: finalDuration, status: 'completed' });
        if (outputSchema) {
          try {
            const data = jsonSafeParse(content);
            if (!data) {
              error(`[AgentExecutor] ❌ Step ${step}: Final output is not a valid JSON object: ${content} `)
              throw new Error("Final output is not a valid JSON object")
            }
            const validated = outputSchema.safeParse(data);
            if (!validated.success) {
              error(`[AgentExecutor] ❌ Step ${step}: Final output does not match schema:, validated.error`)
              throw new Error("Final output does not match schema")
            }
            event.emit(AgentEvent.Completed, { content: validated.data, stats: { ...stats } });
            return validated.data
          } catch (e) {
            error(`[AgentExecutor] ❌ Step ${step}: Final output extraction failed: ${content} `)
            throw new Error("Final output extraction failed")
          }
        }
        event.emit(AgentEvent.Completed, { content, stats: { ...stats } });
        return content;
      }

      if (!content && !toolCalls?.length) {
        warn("[AgentExecutor] ⚠️ LLM returned an empty message. Possibly stuck in a loop.");
        throw new Error("LLM returned an empty message or no content.");
      }

      if (toolCalls && toolCalls.length > 0) {
        log(`[AgentExecutor] 🛠️ Step ${step}: Calling tools: ${toolCalls.map(tc => tc.function.name).join(', ')}`);

        updateStats({ toolCalls: stats.toolCalls + toolCalls.length });

        const outputs = await Promise.all(
          toolCalls.map(toolCall => executeToolCall(toolCall, ctx, signal))
        );

        memory.add(...outputs);
        log(`[AgentExecutor] 📊 Step ${step}: Tool results added to message history.`);

        if (persistentHistory) {
          try {
            await persistentHistory({
              messages: memory.messages,
              step,
              prompt: input,
              ctx,
              llmConfig,
            });
          } catch (persistError) {
            warn(`[AgentExecutor] ⚠️ Failed to persist messages after tool call ${persistError}`);
          }
        }

        return await run({
          input,
          step: step + 1,
          ctx,
          llmConfig,
          signal,
          resetMemory: false,
        });
      }
    } catch (err) {
      const finalDuration = Date.now() - stats.duration;
      updateStats({
        errors: [...stats.errors, err as Error],
        duration: finalDuration,
        status: 'failed'
      });
      event.emit(AgentEvent.Error, { error: err, stats: { ...stats } });
      throw err;
    }
  };


  return {
    id,
    event,
    llm,
    model,
    format,
    run,
    name,
    instructions,
    description,
    outputSchema,
    inputSchema,
    toString,
    memory,
    logger,
    addTool: (tool: Tool<z.ZodObject<any>, z.ZodTypeAny>) => {
      tools.push(tool);
      validateTools();
    },
    removeTool: (name: string) => {
      tools = tools.filter(t => t.name !== name);
    },
    getTools: () => [...tools],
    getStats: () => stats,
    asTool: () =>
      defineTool({
        name: normalizeName(name),
        description: instructions + (description ?? ""),
        validators: {
          args: inputSchema ?? z.object({ prompt: z.string() }),
          return: outputSchema ?? z.object({ content: z.string() })
        },
        handler: async (data, ctx) =>
          await run({
            input: data,
            ctx
          })
      })
    ,
    on: (eventName: AgentEvent, listener: (...args: any[]) => void) => {
      event.on(eventName, listener);
    },
    off: (eventName: AgentEvent, listener: (...args: any[]) => void) => {
      event.off(eventName, listener);
    },
  };
}

export type Agent = ReturnType<typeof createAgent>
