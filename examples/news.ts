import { defineTool } from "../src/tool";
import { z } from "zod";
import { AgentEvent, createAgent } from "../src/agent";
import OpenAI from "openai";

const findCeoTool = defineTool({
  name: "find_company_ceo",
  description: "find the name of the current ceo of a company based on its stock ticker",
  validators: {
    args: z.object({
      company_ticker: z.string().min(2).max(10).describe("company stock ticker"),
    }),
    return: z.string()
  },
  handler: async ({ company_ticker }) => {
    return `the ceo of ${company_ticker} is Tim Cook`;
  }
})

const searchNewsForPersonTool = defineTool({
  name: "search_news_for_person",
  description: "search for the latest news related to a person by their name",
  validators: {
    args: z.object({
      person_name: z.string().min(2).max(100).describe("person's name"),
    }),
    // return: z.string()
    return: z.array(z.string())
  },
  handler: async ({ person_name }) => {
    return ["Apple announced new features for Vision Pro", "MacOS 12 released"]
  }
})

const getStockPriceTool = defineTool({
  name: "get_stock_price",
  description: "get the current stock price for a given company stock ticker",
  validators: {
    args: z.object({
      company_ticker: z.string().min(2).max(10).describe("company stock ticker"),
    }),
    return: z.number()
  },
  handler: async ({ company_ticker }) => {
    return 175.25;
  }
})

const agent = createAgent({
  createProvider: () => ({
    llm: new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.OPENROUTER_BASE_URL,
    }),
    model: "google/gemini-2.5-flash",
    // format: "text"
  }),
  name: "technical_support_bot",
  instructions: "You are familiar with major technology companies and technology news",
  outputSchema: z.object({
    ceo_name: z.string().describe("Name of the CEO"),
    stock_price: z.number().describe("Current stock price"),
    recent_news: z.array(z.string()).describe("Summary of recent news about the CEO")
  }),
  inputSchema: z.object({
    prompt: z.string().describe("User input"),
  }),
  persistentHistory: (data) => {
  },
  verbose: true,
  tools: [findCeoTool, searchNewsForPersonTool, getStockPriceTool],
})

agent.run({
  input: {
    prompt: "I want to know who is the CEO of Apple Inc. (AAPL). Then, help me find out what this CEO recently said (news), and at the same time help me check Apple Inc.'s stock price today."
  }
})
  .then(content => console.log(content))

