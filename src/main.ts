import { defineTool } from "@/tool";
import { z } from "zod";
import { createOpenAICompatibleAgent, AgentEvent } from "@/agent";
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
    return `the ceo of ${company_ticker} is tim cook`;
  }
})

const searchNewsForPersonTool = defineTool({
  name: "search_news_for_person",
  description: "search for the latest news related to a person by their name",
  validators: {
    args: z.object({
      person_name: z.string().min(2).max(100).describe("person's name"),
    }),
    return: z.string()
  },
  handler: async ({ person_name }) => {
    return `news about ${person_name}: ${person_name} announced new features for Vision Pro. ${person_name} emphasized the importance of privacy.`;
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

const agent = createOpenAICompatibleAgent({
  createLLM: () => new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: process.env.OPENROUTER_BASE_URL,
  }),
  model: "google/gemini-2.5-flash",
  persistentHistory: (data) => {
  },
  verbose: false,
  children: [findCeoTool, searchNewsForPersonTool, getStockPriceTool],
})
agent.on(AgentEvent.Log, (data) => {
  // console.log(data)
})
agent.on(AgentEvent.Completed, (data) => {
  console.log(data)
})

agent.execute({ prompt: "I want to know who is the CEO of Apple Inc. (AAPL). Then, help me find out what this CEO recently said (news), and at the same time help me check Apple Inc.'s stock price today." })
  .catch(console.error)

