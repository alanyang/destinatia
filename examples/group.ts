import z from "zod";
import { createAgent } from "../src/agent"
import { createCouncil } from "../src/council"
import { defineTool } from "../src/tool"

const searchNewsTool = defineTool({
  name: "search_news",
  description: "Searches for news articles based on a query.",
  validators: {
    args: z.object({
      query: z.string().describe("The news query, e.g., 'recent tech news', 'football results'"),
    }),
    return: z.array(z.string()).describe("A list of relevant news headlines or summaries."),
  },
  handler: async ({ query }) => {
    console.log(`[TOOL CALL] Executing search_news for query: "${query}"`);
    if (query.toLowerCase().includes("apple") || query.toLowerCase().includes("tech")) {
      return ["Apple launches new Vision Pro 2 headset", "Apple Q1 earnings beat expectations", "Google DeepMind announces breakthrough AI research"];
    } else if (query.toLowerCase().includes("football")) {
      return ["Real Madrid wins Champions League!", "Euro 2024 opening matches"];
    }
    return [`No news found for "${query}"`];
  },
});

// 3. 定义参议员 (Senators)
const plannerSenator = createAgent({
  name: "Planner Senator",
  instructions: `You are a strategic planner. Your task is to understand the user's news request and formulate a precise plan, recommending which expert senator should provide the information.
                 If a search is needed, output the search query. Finally, recommend the next expert senator or indicate completion.`,
  description: "Analyzes news requests and plans information gathering.",
  tools: [searchNewsTool], // Planner Senator 也能调用搜索工具
  inputSchema: z.object({
    news_request: z.string().describe("The user's news request.")
  }),
  outputSchema: z.object({
    plan: z.string().describe("A high-level plan or breakdown of the user's news request."),
    next_speaker: z.string().describe("The name of the expert senator best suited for the next step (e.g., 'Tech News Senator', 'Football News Senator'), or 'FINISH' if you have the final answer, or original query if you need to perform search."),
    search_query: z.string().optional().describe("If a search is needed before assigning to an expert, what should the query be?"),
    final_answer: z.string().optional().describe("If the plan directly results in a final answer.")
  }),
  maxTurns: 3,
  verbose: true,
});

const techNewsSenator = createAgent({
  name: "Tech News Senator",
  instructions: `You are a technology news expert. Provide concise and accurate news updates about technology companies. Use your tools to search for news.`,
  description: "Provides the latest technology news.",
  tools: [searchNewsTool],
  outputSchema: z.object({
    headlines: z.array(z.string()).describe("A list of relevant tech news headlines."),
    source: z.string().describe("The source of the news (e.g., 'internal database', 'simulated RSS feed').")
  }),
  maxTurns: 3,
  verbose: true,
});

const footballNewsSenator = createAgent({
  name: "Football News Senator",
  instructions: `You are a football (soccer) news expert. Provide concise and accurate news updates about football matches, leagues, and teams. Use your tools to search for news.`,
  description: "Provides the latest football (soccer) news.",
  tools: [searchNewsTool],
  outputSchema: z.object({
    match_results: z.array(z.string()).describe("A list of football match results or summaries."),
    league_updates: z.array(z.string()).describe("Updates on football leagues."),
  }),
  maxTurns: 3,
  verbose: true,
});



const senators = [plannerSenator, techNewsSenator, footballNewsSenator];
const council = createCouncil({ senators, maxTurns: 10 }); // 设置议事厅最大轮次
council.run({
  input: "I need to know the latest news on Apple and some recent football match results."
})
  .catch(console.error)
  .then(console.log);
