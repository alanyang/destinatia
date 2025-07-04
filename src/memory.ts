import { ChatCompletionMessageParam } from "openai/resources/index";
import { Context } from "./tool";

export type CompressFunc<T extends ChatCompletionMessageParam = ChatCompletionMessageParam> = (
  messages: T[],
  options?: Record<string, unknown>,
) => T[];
export function slideWindowCompression<
  T extends ChatCompletionMessageParam = ChatCompletionMessageParam
>
  (
    messages: T[],
    { windowSize = 20 }: { windowSize?: number }
  ): T[] {
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


  const lastFrontRole =
    frontMessages.length > 0
      ? frontMessages[frontMessages.length - 1].role
      : systemMessage
        ? systemMessage.role
        : "assistant";

  const firstBackRole =
    backMessages.length > 0
      ? backMessages[0].role
      : lastFrontRole === "user" ? "assistant" : "user";

  const needTruncated =
    frontMessages.length > 0 &&
    backMessages.length > 0 &&
    lastFrontRole === firstBackRole;

  const truncatedRole = lastFrontRole === "user" ? "assistant" : "user";

  const compressed: T[] = [
    ...(systemMessage ? [systemMessage] : []),
    ...frontMessages,
    ...(needTruncated
      ? [{ role: truncatedRole, content: "[CONTEXT_TRUNCATED]" } as T]
      : []),
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
    return this.memories.map(m => ({ ...m }));
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

  toString() {
    return JSON.stringify(this.memories, null, 2)
  }

  static buildHandoffSystemMessage({
    from, to, ctx = {}
  }: {
    from: Memory, to: Memory, ctx?: Context
  }): string {
    return `
# AGENT HANDOFF: ${from.name} -> ${to.name}

## Previous Agent Context:
${from.systemMessage}

## Current Agent Instructions:
${to.systemMessage}

## Handoff Context:
\`\`\`json
${JSON.stringify(ctx, null, 2)}
\`\`\`

## Guidelines:
- You have full access to the conversation history
- Continue the task seamlessly from where the previous agent left off
- Use your specialized capabilities as ${to.name}
`
  }

  createHandoffSystemMessage({
    from, ctx = {}
  }: {
    from: Memory<T>, ctx?: Context
  }): T {
    const message = Memory.buildHandoffSystemMessage({ from, to: this, ctx })
    return { role: "system" as const, content: message } as T
  }

  handoff({ from, inherit = false }: { from: Memory<T>, inherit?: boolean }) {
    const newSystemMessage = this.createHandoffSystemMessage({ from });
    const [_, ...messages] = this.memories
    const [_system, ...fromMessages] = from.memories

    const memories = !inherit ?
      [newSystemMessage, ...messages] :
      [newSystemMessage, ...fromMessages, ...messages]
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
        effectiveMessages = slideWindowCompression(effectiveMessages, { windowSize: this.maxHistory });
      }
    }
    this.memories = [...effectiveMessages]
    return effectiveMessages;
  }
}


