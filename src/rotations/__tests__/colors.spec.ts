import {
  colorForEngineer,
  ENGINEER_COLORS,
  engineerColor,
  isValidEngineerColor,
  isValidEngineerPattern,
  randomEngineerColor,
} from "../colors"
import { Engineer } from "../types"

const engineer = (overrides: Partial<Engineer> = {}): Engineer => ({
  id: "eng-a",
  name: "Ada Lovelace",
  email: "ada@example.com",
  slackUserId: null,
  active: true,
  color: null,
  pattern: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
})

describe("colorForEngineer", () => {
  it("uses the engineer's chosen color when set", () => {
    expect(colorForEngineer(engineer({ color: "#30A46C" }), "eng-a")).toBe(
      "#30A46C"
    )
  })

  it("falls back to the hashed default when color is null (Auto)", () => {
    expect(colorForEngineer(engineer({ color: null }), "eng-a")).toBe(
      engineerColor("eng-a")
    )
  })

  it("falls back to the hashed default when there is no engineer record", () => {
    expect(colorForEngineer(undefined, "eng-a")).toBe(engineerColor("eng-a"))
  })
})

describe("isValidEngineerColor", () => {
  it("accepts null/undefined (Auto)", () => {
    expect(isValidEngineerColor(null)).toBe(true)
    expect(isValidEngineerColor(undefined)).toBe(true)
  })

  it("accepts a curated palette value", () => {
    expect(isValidEngineerColor("#6E56CF")).toBe(true)
  })

  it("rejects a color outside the curated palette", () => {
    expect(isValidEngineerColor("#123456")).toBe(false)
  })
})

describe("randomEngineerColor", () => {
  it("always returns a curated palette value", () => {
    for (let i = 0; i < 20; i++) {
      expect(ENGINEER_COLORS).toContain(randomEngineerColor())
    }
  })
})

describe("isValidEngineerPattern", () => {
  it("accepts null/undefined (none)", () => {
    expect(isValidEngineerPattern(null)).toBe(true)
    expect(isValidEngineerPattern(undefined)).toBe(true)
  })

  it("accepts a known pattern", () => {
    expect(isValidEngineerPattern("sparkles")).toBe(true)
  })

  it("rejects an unknown pattern", () => {
    expect(isValidEngineerPattern("confetti")).toBe(false)
  })
})
