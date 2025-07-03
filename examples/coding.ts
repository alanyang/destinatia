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


const programmerAgent = createAgent({
  createProvider,
  name: "programmer agent",
  instructions: "You are an experienced programmer, good at programming languages"
});

const reviewerAgent = createAgent({
  createProvider,
  name: "reviewer agent",
  instructions: `
You are a code reviewer, good at finding potential bugs in the code, good at optimizing the code, and able to give detailed modification suggestions.
`
});


const projectManagerAgent = createAgent({
  createProvider,
  name: "project manager agent",
  verbose: true,
  instructions: `
You are a project manager. According to user needs, you write code according to the following steps
1. Write the code to the programmer
2. The programmer's code is submitted to the reviewer for review
3. If the review is passed, the code is delivered, otherwise the review suggestions and opinions are resubmitted to the programmer
Repeat 1->2->1->2 until the code is finally reviewed and passed
`,
  tools: [programmerAgent.asTool(), reviewerAgent.asTool()]
});


(async () => {
  const r = await projectManagerAgent.run({
    input: "Use Python to write a heap sort algorithm, requiring generalization, good type hints, and the code should be as functional as possible."
  })
  console.log(r)
})()
  .finally(process.exit)

