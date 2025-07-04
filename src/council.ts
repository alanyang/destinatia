import z from "zod";
import { createAgent, Agent } from "./agent";
import { ChatCompletionMessageParam } from "openai/resources/index";

type Input = {
  input: string | Record<string, any>,
}

type PresidentArgs = {
  senators: Agent[]
}

export type CouncilAgrs = {
  maxTurns?: number
} & PresidentArgs

export function createCouncil({
  senators,
  maxTurns = 58
}: CouncilAgrs) {
  let currentTurn = 0
  const minutes: ChatCompletionMessageParam[] = []

  const { president, secretary } = createDais({ senators })


  const run = async ({ input }: Input) => {
    minutes.push({
      role: "user",
      content: typeof input === "string" ? input : JSON.stringify(input),
    });

    while (currentTurn < maxTurns) {
      const managerDecisionResult = await president.run({
        input: "",
        messages: [...minutes],
      });

      let nextSpeakerName: string | undefined;
      if (typeof managerDecisionResult === 'object' && managerDecisionResult !== null && 'next_speaker' in managerDecisionResult) {
        nextSpeakerName = (managerDecisionResult as { next_speaker: string }).next_speaker;
      } else {
        nextSpeakerName = managerDecisionResult?.toString().trim();
      }

      if (!nextSpeakerName || nextSpeakerName.toUpperCase() === "FINISH") {
        return await secretary.run({
          input: "",
          messages: [...minutes],
        });
      }

      const speaker = senators.find(m => m.name.toLowerCase().replace(/\s+/g, '_') === nextSpeakerName?.toLowerCase().replace(/\s+/g, '_'));
      currentTurn++;

      if (!speaker) {
        minutes.push({
          role: "system",
          content: `Manager selected an invalid agent '${nextSpeakerName}'. Please choose a valid agent from ${senators.map(m => m.name).join(', ')} or FINISH.`,
        });
        continue;
      }

      try {
        const agentResponse = await speaker.run({
          input: "",
          messages: [...minutes],
          step: currentTurn,
        });

        if (typeof agentResponse === 'string' && agentResponse.length > 0) {
          minutes.push({ role: 'assistant', content: agentResponse, name: speaker.name });
        } else if (typeof agentResponse === 'object' && agentResponse !== null) {
          minutes.push({ role: 'assistant', content: JSON.stringify(agentResponse), name: speaker.name });
        }
      } catch (error) {
        minutes.push({
          role: "system",
          content: `${speaker.name} encountered an error: ${(error as Error).message}. Manager, please choose next speaker or FINISH.`,
        });
      }
    }

    return await secretary.run({
      input: "",
      messages: [...minutes],
    });
  }

  return {
    run,
  }
}

export function createDais({
  senators
}: PresidentArgs) {
  const president = createAgent({
    name: "Council president",
    instructions: `You are the manager of a group of agents. Your goal is to guide the conversation to solve the user's request.
                   Based on the current conversation and the capabilities of the available agents, choose the most suitable agent to speak next.
                   When the task is complete, or no other agent is needed, or if you need more information from the user, you can output 'FINISH'. Don't select yourself as tool.`,
    description: "Orchestrates the conversation flow between other agents.",
    tools: senators.map(v => v.asTool()),
    outputSchema: z.object({
      next_speaker: z.string().describe(`The name of the agent who should speak next, or 'FINISH' if the task is complete.`)
    }),
    verbose: true,
  });


  const secretary = createAgent({
    name: "Council secretary",
    instructions: `You are a conversation summarizer. Summarize the provided conversation and extract the final answer.`,
    description: "Summarizes group chat conversations.",
    outputSchema: z.object({
      summary: z.string().describe("Concise summary of the conversation."),
      final_answer: z.string().describe("The final answer or result of the task."),
    }),
    maxTurns: 1,
  });

  return { president, secretary };
};
