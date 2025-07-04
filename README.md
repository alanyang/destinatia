## Destinatia

*This is a general multi-agent dialogue system framework for building conversational agents.simplicity, flexibility, and observable are the key features of Destinatia. It provides a simple and intuitive way to build and manage multi-agent dialogue systems with event system. It is designed to be easy to use, with a simple and intuitive API, and can be easily integrated into any existing codebase or framework.*

> Statuses: Our project [Blueapex Insurance](https://markdown.com.cn "Blueapex insurance") is already using it, but it has not been published to npm, and issues are not being handled until version 0.2 is released. It is not recommended to use it in a production environment.

---

#### Common AI Agent Patterns

*Few shot*
```typescript
import { createAgent } from "../src/agent"

const agent = createAgent({
  name: "Insurance Manager",
  instructions: "You are Insurance Manager. Please provide me with the latest insurance information. don't answer any questions that are not related to insurance."
})

agent.run({
  input: "Do pension insurance and savings insurance have overlapping functions, and is it sufficient to purchase only one?"
})
  .then(console.log)
  .finally(process.exit)
```



*ReAct*
```typescript
import { defineTool } from "../src/tool";
import { z } from "zod";
import { createAgent } from "../src/agent";
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
```



*Multi agents handoff*
```typescript
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
  // outputSchema,
  // verbose: true,
  instructions: "Handoff to the appropriate agent based on the language of the request.",
  description: "You are a triage agent. You will hand off the request to the appropriate agent based on the language of the request.",
  tools: [spanishAgent.asTool(), englishAgent.asTool(), chineseAgent.asTool(), japaneseAgent.asTool()]
});


(async () => {
  triageAgent.logger.debug(await triageAgent.run({ input: "你好!你是谁？都会什么" }))
  triageAgent.logger.debug(await triageAgent.run({ input: "こんにちは!私は誰ですか？何をしますか？" }))
  triageAgent.logger.debug(await triageAgent.run({ input: "Hello! Who are you? What do you do?" }))
  triageAgent.logger.debug(await triageAgent.run({ input: "¡Hola! ¿Quién eres? ¿A qué te dedicas?" }))
})()
  .finally(process.exit)

```
