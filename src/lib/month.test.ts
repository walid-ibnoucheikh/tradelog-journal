import { describe, expect, it } from "vitest"
import { monthKey, parseMonth, shiftMonth } from "./month"

describe("parseMonth", () => {
  it("accepts YYYY-MM and rejects anything else", () => {
    expect(parseMonth("2026-03")).toEqual({ year: 2026, month: 3 })
    expect(parseMonth("2026-13")).toBeNull()
    expect(parseMonth("2026-3")).toBeNull()
    expect(parseMonth(undefined)).toBeNull()
    expect(parseMonth(["2026-03"])).toBeNull()
  })
})

describe("shiftMonth", () => {
  it("rolls over year boundaries", () => {
    expect(shiftMonth(2026, 1, -1)).toBe("2025-12")
    expect(shiftMonth(2026, 12, 1)).toBe("2027-01")
    expect(shiftMonth(2026, 5, 0)).toBe("2026-05")
  })
})

describe("monthKey", () => {
  it("pads the month", () => {
    expect(monthKey(2026, 3)).toBe("2026-03")
  })
})
