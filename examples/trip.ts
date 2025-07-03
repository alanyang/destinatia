
import OpenAI from "openai";
import { createAgent } from "../src/agent";
import z from "zod";
import { defineTool } from "../src/tool";

const createProvider = () => ({
  llm: new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: process.env.OPENROUTER_BASE_URL,
  }),
  model: "google/gemini-2.5-flash",
})


const tickBookingTool = defineTool({
  name: "Tick Booking Tool",
  description: "This tool can help you book a flight ticket",
  validators: {
    args: z.object({
      departureDay: z.string(),
      departure: z.string().optional().describe("The departure of your trip"),
      destination: z.string().describe("The destination of your trip")
    }),
    return: z.string()
  },
  handler: async ({ departureDay, departure, destination }) => {
    return `The ticket was successfully booked, flight CA9328, airline China Airlines, departure date ${departureDay}, departure place ${departure ?? "home"}, destination ${destination}`
  }
})


const hotelReservationsTool = defineTool({
  name: "Hotel Reservations Tool",
  description: "This tool can help you book a hotel reservation",
  validators: {
    args: z.object({
      location: z.string().describe("The location where you want to stay"),
      requirements: z.string().optional().describe("The requirements for your stay")
    }),
    return: z.string()
  },
  handler: async ({ location, requirements }) => {
    return `The hotel reservation was successfully booked, hotel ${location}, with ${requirements ?? "no requirements"}`
  }
})

const calendarTool = defineTool({
  name: "calendar_tool",
  description: "This tool can tell you what's today's date",
  validators: {
    return: z.string()
  },
  handler: () => {
    return `Today is 2025/7/3`
  }
})


const TravelAgent = createAgent({
  createProvider,
  name: "Travel agent",
  verbose: true,
  instructions: "You are travel assistant, good at planning travel routes, booking hotels and restaurants, and giving travel suggestions",
  tools: [tickBookingTool, hotelReservationsTool, calendarTool]
});


(async () => {
  const result = await TravelAgent.run({
    input: "I want to travel to Shanghai for three days, departure today"
  })
  console.log(result)
})()
  .finally(process.exit)

