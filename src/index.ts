export * from "./tool"
import { z } from "zod"

function a(param: z.ZodTypeAny[]) {
}

const validators = [z.string(), z.number(), z.boolean(), z.object({
  name: z.string(),
})]

a(validators)
