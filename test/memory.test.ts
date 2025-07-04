import { Memory } from "../src/memory"

describe("Memory", () => {
  test("constructor", () => {
    const m = new Memory({ name: "test", systemMessage: "test message" })
    expect(m.messages).toEqual([
      { role: "system", content: "test message" }
    ])
  })


  test("size", () => {
    const m = new Memory({ name: "test", systemMessage: "test message" })
    expect(m.size).toBe(1)

    m.add({ role: "user", content: "hello" })
    m.add({ role: "user", content: "hello" })
    m.add({ role: "user", content: "hello" })
    expect(m.size).toBe(4)
  })

  test("reset", () => {
    const m = new Memory({ name: "test", systemMessage: "test message" })
    m.reset()
    expect(m.messages).toEqual([])
  })

  test("add", () => {
    const m = new Memory({ name: "test", systemMessage: "test message" })
    m.add({ role: "user", content: "hello" })
    m.add({ role: "user", content: "hello" })
    m.add({ role: "user", content: "hello" })
    expect(m.messages).toEqual([
      { role: "system", content: "test message" },
      { role: "user", content: "hello" },
      { role: "user", content: "hello" },
      { role: "user", content: "hello" }
    ])
  })

  test("system message", () => {
    const m = new Memory({ name: "test", systemMessage: "system" })
    expect(m.systemMessage).toBe("system")
  })

  describe("replace system message", () => {
    test("only once", () => {
      const m = new Memory({ name: "test", systemMessage: "system" })
      m.replaceSystemMessage("newSystem")
      expect(m.systemMessage).toBe("newSystem")
    })

    test("with empty", () => {
      const m = new Memory({ name: "test", systemMessage: "system" })
      m.reset()
      expect(m.systemMessage).toBe("")
    })

    test("more messages", () => {
      const m = new Memory({ name: "test", systemMessage: "system" })
      m.add({ role: "user", content: "hello" })
      m.add({ role: "user", content: "hello" })
      m.add({ role: "user", content: "hello" })
      m.add({ role: "user", content: "hello" })
      m.replaceSystemMessage("newSystem")
      expect(m.systemMessage).toBe("newSystem")
    })
  })

  describe("handoff", () => {
    test("only system", () => {
      const from = new Memory({ name: "test", systemMessage: "from system message" })
      from.add({ role: "user", content: "hello" })
      from.add({ role: "user", content: "hello" })
      const to = new Memory({ name: "dist", systemMessage: "dist system message" })

      const expected = Memory.buildHandoffSystemMessage({ from, to, ctx: {} })

      to.handoff({ from })

      const actual = to.systemMessage

      expect(actual).toBe(expected)
    })

    test("with inherit", () => {
      const from = new Memory({ name: "test", systemMessage: "from system message" })
      from.add({ role: "user", content: "1" })
      from.add({ role: "user", content: "2" })
      const to = new Memory({ name: "dist", systemMessage: "dist system message" })

      const expectedSystem = Memory.buildHandoffSystemMessage({ from, to, ctx: {} })

      const expected = [
        { role: "system", content: expectedSystem },
        { role: "user", content: "1" },
        { role: "user", content: "2" }
      ]

      to.handoff({ from, inherit: true })

      expect(to.messages).toEqual(expected)

    })
  })


  describe("arrange", () => {
    test("should compress messages when exceeding maxHistory", () => {
      const m = new Memory({ name: "test", systemMessage: "sys", maxHistory: 5 })

      for (let i = 1; i <= 10; i++) {
        m.add({ role: "user", content: `u${i}` })
      }

      const arranged = m.arrange();

      expect(arranged[0]).toEqual({ role: "system", content: "sys" })
      expect(arranged.some(msg => msg.content === "[CONTEXT_TRUNCATED]")).toBe(true)
      expect(arranged.length).toBeLessThanOrEqual(7)
    })


    test("should compress messages using slideWindowCompression when exceeding maxHistory", () => {
      const m = new Memory({ name: "test", systemMessage: "sys", maxHistory: 5 })

      for (let i = 1; i <= 10; i++) {
        m.add({ role: "user", content: `u${i}` })
      }

      const arranged = m.arrange()

      expect(arranged).toEqual([
        { role: "system", content: "sys" },
        { role: "user", content: "u1" },
        { role: "assistant", content: "[CONTEXT_TRUNCATED]" },
        { role: "user", content: "u7" },
        { role: "user", content: "u8" },
        { role: "user", content: "u9" },
        { role: "user", content: "u10" }
      ])
    })
  })

})
