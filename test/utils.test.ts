import { jsonSafeParse, normalizeName } from "../src/utils";

describe("jsonSafeParse", () => {
  test("parses plain JSON string", () => {
    const input = '{"a":1,"b":2}';
    expect(jsonSafeParse(input)).toEqual({ a: 1, b: 2 });
  });

  test("parses JSON in markdown code block", () => {
    const input = "```json\n{\"a\":1,\"b\":2}\n```";
    expect(jsonSafeParse(input)).toEqual({ a: 1, b: 2 });
  });

  test("parses JSON in code block with json tag with other text", () => {
    const input = `
parses JSON in code block with json tag with other text
\`\`\`js\n{\"a\":1}\n\`\`\`



psdf 
asdparses JSON in code block with json tag with other text
    `
    expect(jsonSafeParse(input)).toEqual({ a: 1 });
  })

  test("parses JSON in code block with js tag", () => {
    const input = "```js\n{\"a\":1}\n```";
    expect(jsonSafeParse(input)).toEqual({ a: 1 });
  });

  test("parses JSON with extra text before and after", () => {
    const input = "some text before {\"a\":1} some text after";
    expect(jsonSafeParse(input)).toEqual({ a: 1 });
  });

  test("returns null for invalid JSON", () => {
    const input = "not a json";
    expect(jsonSafeParse(input)).toBeNull();
  });

  test("parses JSON with trailing comma after repair", () => {
    const input = '{"a":1,"b":2,}';
    expect(jsonSafeParse(input)).toEqual({ a: 1, b: 2 });
  });

  test("parses JSON with single quotes after repair", () => {
    const input = "{'a':1,'b':2}";
    expect(jsonSafeParse(input)).toEqual({ a: 1, b: 2 });
  });

  test("returns null for empty string", () => {
    expect(jsonSafeParse("")).toBeNull();
  });

  test("returns null for whitespace string", () => {
    expect(jsonSafeParse("   ")).toBeNull();
  });
});

describe("normailizeName", () => {
  test("converts to lowercase and replaces spaces with underscores", () => {
    expect(normalizeName("My Tool Name")).toBe("my_tool_name");
  });

  test("handles already normalized name", () => {
    expect(normalizeName("already_normalized")).toBe("already_normalized");
  });

  test("handles empty string", () => {
    expect(normalizeName("")).toBe("");
  });
});
