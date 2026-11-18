import { describe, expect, it } from "vitest"
import {
  inRange,
  parsePeriod,
  periodLabel,
  periodRange,
  periodYears,
  tradingPnlInPeriod,
} from "./period"

describe("parsePeriod", () => {
  it("accepts all, 12m and a four-digit year, and falls back to all", () => {
    expect(parsePeriod("12m")).toBe("12m")
    expect(parsePeriod("2026")).toBe("2026")
    expect(parsePeriod(["2025"])).toBe("2025")
    expect(parsePeriod("autre")).toBe("all")
    expect(parsePeriod(undefined)).toBe("all")
  })
})

describe("periodRange", () => {
  it("has no bounds for everything", () => {
    expect(periodRange("all", "2026-10-28")).toBeNull()
  })

  it("covers a whole calendar year", () => {
    expect(periodRange("2025", "2026-10-28")).toEqual({ from: "2025-01-01", to: "2025-12-31" })
  })

  it("starts the last 12 months on the first day of the month eleven months back", () => {
    expect(periodRange("12m", "2026-10-28")).toEqual({ from: "2025-11-01", to: "2026-10-28" })
    expect(periodRange("12m", "2026-03-05")).toEqual({ from: "2025-04-01", to: "2026-03-05" })
  })
})

describe("inRange", () => {
  const range = { from: "2026-01-01", to: "2026-12-31" }

  it("includes both ends and nothing outside", () => {
    expect(inRange("2026-01-01", range)).toBe(true)
    expect(inRange("2026-12-31", range)).toBe(true)
    expect(inRange("2025-12-31", range)).toBe(false)
    expect(inRange("2027-01-01", range)).toBe(false)
  })

  it("includes every day when there is no range", () => {
    expect(inRange("1999-01-01", null)).toBe(true)
  })
})

describe("periodYears and periodLabel", () => {
  it("lists the years with a transaction and the current one, newest first", () => {
    expect(periodYears(["2025-03-01", "2025-09-09", "2026-01-02"], "2026-10-28")).toEqual([
      "2026",
      "2025",
    ])
    expect(periodYears([], "2026-10-28")).toEqual(["2026"])
  })

  it("names the periods", () => {
    expect(periodLabel("all")).toBe("All time")
    expect(periodLabel("12m")).toBe("Last 12 months")
    expect(periodLabel("2026")).toBe("2026")
  })
})

describe("tradingPnlInPeriod", () => {
  const results = new Map([
    [
      "a",
      [
        { closedAt: new Date("2025-12-15T15:00:00Z"), netPnl: 100 },
        { closedAt: new Date("2026-03-10T15:00:00Z"), netPnl: -40.5 },
        { closedAt: new Date("2026-03-11T15:00:00Z"), netPnl: 10 },
      ],
    ],
  ])

  it("sums the trades closed in the period only", () => {
    expect(tradingPnlInPeriod(results, { from: "2026-01-01", to: "2026-12-31" }).get("a")).toBe(
      -30.5
    )
  })

  it("sums everything without a period", () => {
    expect(tradingPnlInPeriod(results, null).get("a")).toBe(69.5)
  })
})
