import { ChatCompletionMessageParam } from "openai/resources/index";
import { AgentArgs, AgentEvent, createAgent, LLMConfig } from "./agent";
import { Context } from "./tool"

export type PersistenceParams = {
  messages: ChatCompletionMessageParam[];
  step: number;
  prompt?: string | Record<string, unknown>;
  ctx?: Context;
  llmConfig?: LLMConfig;
};


export type RecoverAgentArgs = {
  messages: ChatCompletionMessageParam[];
  input?: Record<string, unknown> | string;
  step?: number;
  ctx?: Context;
  llmConfig?: LLMConfig;
};


export type PersistentHistoryFunction = (params: PersistenceParams) => void | Promise<void>;

export function recoverAgent(
  agentArgs: AgentArgs,
  recoveryData: RecoverAgentArgs
) {
  const agent = createAgent(agentArgs);

  const continueExecution = async (signal?: AbortSignal) => {
    const { messages, input, step = 0, ctx, llmConfig } = recoveryData;

    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error("Invalid recovery data: messages must be a non-empty array");
    }

    agent.event.emit(AgentEvent.Log,
      `[AgentExecutor] 🔄 Recovering from step ${step} with ${messages.length} messages`
    );

    return agent.run({
      input,
      messages: [...messages],
      step: step + 1,
      ctx,
      llmConfig,
      signal,
    });
  };

  return {
    ...agent,
    continueExecution,
    getRecoveryInfo: () => ({
      currentStep: recoveryData.step || 0,
      messageCount: recoveryData.messages.length,
      lastMessage: recoveryData.messages[recoveryData.messages.length - 1],
    }),
  };
}
