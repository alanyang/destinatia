import OpenAI from "openai";

export type providerFactory = () => { llm: OpenAI, model: string, format?: "json_object" | "text" }

export function createDefaultProvider() {
  return {
    llm: new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.OPENROUTER_BASE_URL,
    }),
    model: "google/gemini-2.5-flash",
  }
}
