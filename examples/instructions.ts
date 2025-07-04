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
