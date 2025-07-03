import { z } from "zod"
import { zodToJsonSchema } from "zod-to-json-schema"
import { normailizeName } from "./utils";

export type Context = Record<string, unknown>;
export type ToolMiddleware =
  (args: any, next: (modifiedArgs: any) => Promise<any>, ctx?: Context) => Promise<any>;

export type Tool<
  PType extends z.ZodObject<any>,
  RType extends z.ZodTypeAny
> = {
  name: string,
  description: string,
  handler: (args: z.infer<PType>, ctx?: Context) => Promise<z.infer<RType>> | z.infer<RType>,
  validators?: {
    args?: PType,
    return?: RType,
  },
  middlewares?: ToolMiddleware[],
  timeout?: number,
}

export function toolModelSchema<
  P extends z.ZodObject<any>,
  R extends z.ZodTypeAny
>(tool: Tool<P, R>) {
  return {
    type: "function" as const,
    function: {
      name: tool.name, description: tool.description,
      parameters: tool.validators?.args ? zodToJsonSchema(tool.validators.args, {
        target: "openApi3",
        removeAdditionalStrategy: "passthrough"
      }) : ""
    }
  }
}

export function defineTool<
  P extends z.ZodObject<any>,
  R extends z.ZodTypeAny,
>(config: {
  name: string;
  description: string;
  handler: (args: z.infer<P>, ctx?: Context) => Promise<z.infer<R>> | z.infer<R>;
  validators?: {
    args?: P;
    return?: R;
  };
}): Tool<P, R> {
  const { name } = config
  return { ...config, name: normailizeName(name) }
}
