import { ChatCompletionMessageParam } from "openai/resources/index";
import { Context } from "./tool";

export type CompressFunc<T extends ChatCompletionMessageParam = ChatCompletionMessageParam> = (
  messages: T[],
  options?: Record<string, unknown>,
) => T[];
export const slideWindowCompression =
  <T extends ChatCompletionMessageParam = ChatCompletionMessageParam>
    (messages: T[], { windowSize = 20 }: { windowSize?: number }): T[] => {
    const systemMessage = messages.find(m => m.role === "system");

    const nonSystemMessages = messages.filter(m => m.role !== "system");

    const effectiveWindowSize = Math.max(windowSize, (systemMessage ? 1 : 0) + 1);

    if (nonSystemMessages.length <= effectiveWindowSize) {
      return [...(systemMessage ? [systemMessage] : []), ...nonSystemMessages];
    }

    const [frontCount, backCount] = [
      Math.floor((effectiveWindowSize - 1) / 3),
      Math.ceil((effectiveWindowSize - 1) / 3) * 2
    ];

    const frontMessages = nonSystemMessages.slice(0, frontCount);
    const backMessages = nonSystemMessages.slice(Math.max(0, nonSystemMessages.length - backCount));

    const compressed: T[] = [
      ...(systemMessage ? [systemMessage] : []),
      ...frontMessages,
      {
        role: "system" as const,
        content: "[CONTEXT_TRUNCATED]"
      } as T,
      ...backMessages,
    ];
    return compressed;
  }


type MemoryArgs = {
  name: string
  systemMessage: string
  maxHistory?: number;
}
export class Memory<
  T extends ChatCompletionMessageParam = ChatCompletionMessageParam
> {

  name: string
  instructions: string
  private memories: T[] = [];

  private defaultMaxHistory: number = 60;

  maxHistory: number = this.defaultMaxHistory;

  constructor({ name, systemMessage, maxHistory }: MemoryArgs) {
    this.name = name
    this.instructions = systemMessage
    this.maxHistory = maxHistory ?? this.defaultMaxHistory;
    const system = {
      role: "system" as const,
      content: systemMessage
    } as T
    this.memories = [system]
  }

  get messages(): T[] {
    return [...this.memories]
  }

  get size(): number {
    return this.memories.length
  }

  get systemMessage(): string {
    const m = this.memories.find(m => m.role === "system")?.content ?? "";
    return m as string
  }

  replaceSystemMessage(message: string) {
    const [first, ...messages] = this.memories
    if (!first) {
      this.memories = [{ role: "system", content: message } as T]
      return
    }
    if (first?.role === "system") {
      this.memories = [
        { role: "system", content: message } as T,
        ...(messages ?? [])
      ]
    } else {
      this.memories = [
        { role: "system", content: message } as T,
        first,
        ...(messages ?? [])
      ]
    }
  }


  add(...messages: T[]) {
    if (messages.every(m => m.role)) {
      this.memories.push(...messages);
    }
  }

  reset() {
    this.memories = [];
  }

  toStirng() {
    return JSON.stringify(this.memories, null, 2)
  }

  createHandoffSystemMessage({
    from, ctx = {}
  }: {
    from: Memory<T>, ctx?: Context
  }): T {
    const message = `
# AGENT HANDOFF: ${from.name} -> ${this.name}

## Previous Agent Context:
${from.systemMessage}

## Current Agent Instructions:
${this.systemMessage}

## Handoff Context:
\`\`\`json
${JSON.stringify(ctx, null, 2)}
\`\`\`

## Guidelines:
- You have full access to the conversation history
- Continue the task seamlessly from where the previous agent left off
- Use your specialized capabilities as {to_agent.name}
`
    return { role: "system" as const, content: message } as T
  }

  handoff(from: Memory<T>) {
    const newSystemMessage = this.createHandoffSystemMessage({ from });
    const [_, ...messages] = this.memories
    const memories = [newSystemMessage, ...messages]
    this.memories = memories
  }

  arrange(
    compress?: CompressFunc<T>
  ) {
    let effectiveMessages = [...this.memories];
    if (this.maxHistory > 0 && effectiveMessages.length > this.maxHistory) {
      if (compress) {
        effectiveMessages = compress(effectiveMessages);
      } else {
        effectiveMessages = slideWindowCompression(effectiveMessages, { windowSize: 30 });
      }
    }
    this.memories = [...effectiveMessages]
    return effectiveMessages;
  }
}


