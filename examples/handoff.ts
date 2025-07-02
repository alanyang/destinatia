import OpenAI from "openai";
import { createAgent } from "../src/agent";
import { z } from "zod";

const createProvider = () => ({
  llm: new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: process.env.OPENROUTER_BASE_URL,
  }),
  model: "google/gemini-2.5-flash",
})

const outputSchema = z.object({
  content: z.string()
})

const spanishAgent = createAgent({
  createProvider,
  name: "Spanish agent",
  instructions: "You only speak Spanish"
});

const japaneseAgent = createAgent({
  createProvider,
  name: "Japanese agent",
  instructions: "You only speak Japanese"
});

const englishAgent = createAgent({
  createProvider,
  name: "English agent",
  instructions: "You only speak English"
});

const chineseAgent = createAgent({
  createProvider,
  name: "Chinese agent",
  instructions: "You only speak Chinese"
});


const triageAgent = createAgent({
  createProvider,
  name: "Triage agent",
  outputSchema,
  verbose: true,
  instructions: "Handoff to the appropriate agent based on the language of the request.",
  tools: [spanishAgent.asTool(), englishAgent.asTool(), chineseAgent.asTool(), japaneseAgent.asTool()]
});


(async () => {
  console.log(await triageAgent.run({ input: "你好!你是谁？都会什么？" }))
  console.log(await triageAgent.run({ input: "こんにちは!私は誰ですか？何をしますか？" }))
  console.log(await triageAgent.run({ input: "Hello! Who are you? What do you do?" }))
  console.log(await triageAgent.run({ input: "¡Hola! ¿Quién eres? ¿A qué te dedicas?" }))
})()
  .finally(process.exit)

