import { z } from "zod";
import { defineTool, toolModelSchema, Tool } from "../src/tool";

describe("defineTool", () => {
  test("should normalize tool name", () => {
    const tool = defineTool({
      name: "My Tool",
      description: "desc",
      handler: async () => ({ result: 1 }),
      validators: {
        args: z.object({ a: z.number() }),
        return: z.object({ result: z.number() }),
      }
    });
    expect(tool.name).toBe("my_tool");
    expect(tool.description).toBe("desc");
    expect(typeof tool.handler).toBe("function");
  });

  test("should work without validators", () => {
    const tool = defineTool({
      name: "NoValidator",
      description: "desc",
      handler: async () => 42,
    });
    expect(tool.name).toBe("novalidator");
    expect(tool.validators).toBeUndefined();
  });
});

describe("toolModelSchema", () => {
  test("should generate correct schema with args", () => {
    const tool = defineTool({
      name: "add",
      description: "add two numbers",
      handler: async ({ a, b }) => ({ sum: a + b }),
      validators: {
        args: z.object({ a: z.number(), b: z.number() }),
        return: z.object({ sum: z.number() }),
      }
    });
    const schema = toolModelSchema(tool);
    expect(schema.type).toBe("function");
    expect(schema.function.name).toBe("add");
    expect(schema.function.description).toBe("add two numbers");
    expect(schema.function.parameters).toHaveProperty("properties");

    if (
      typeof schema.function.parameters === "object" &&
      schema.function.parameters !== null &&
      "properties" in schema.function.parameters
    ) {
      const params = schema.function.parameters as { properties: Record<string, unknown> };
      expect(params.properties).toHaveProperty("a");
      expect(params.properties).toHaveProperty("b");
    } else {
      throw new Error("parameters does not have properties field");
    }

  });

  test("should generate empty parameters if no args validator", () => {
    const tool = defineTool({
      name: "noop",
      description: "no args",
      handler: async () => ({}),
    });
    const schema = toolModelSchema(tool);
    expect(schema.function.parameters).toBe("");
  });
});
