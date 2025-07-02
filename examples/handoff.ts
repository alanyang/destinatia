import OpenAI from "openai";
import { AgentEvent, createAgent } from "../src/agent";

const createProvider = () => ({
  llm: new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: process.env.OPENROUTER_BASE_URL,
  }),
  model: "google/gemini-2.5-flash",
})

const spanishAgent = createAgent({
  createProvider,
  name: "Spanish agent",
  instructions: "You only speak Spanish"
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
  instructions: "Handoff to the appropriate agent based on the language of the request.",
  tools: [spanishAgent.asTool(), englishAgent.asTool(), chineseAgent.asTool()]
});


triageAgent.on(AgentEvent.Log, console.log)
triageAgent.on(AgentEvent.Completed, ({ stats }) => console.log(stats))

triageAgent
  .run({ input: "你好!你是谁？都会什么？" })
  .then(console.log);


