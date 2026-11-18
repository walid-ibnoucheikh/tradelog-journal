import { describe, expect, it } from "vitest"
import { buildBalanceSeries, clipToPeriod, sumBalances } from "./balance-series"

// October 2026 is on EDT (UTC-4): 15:00Z is 11:00 in New York, inside the session of that day.
const at = (day: number) => new Date(Date.UTC(2026, 9, day, 15))

describe("buildBalanceSeries", () => {
  it("gives the end-of-session balance, one point per trading day", () => {
    const trades = [
      { closedAt: at(5), netPnl: 500 },
      { closedAt: at(5), netPnl: -100 },
      { closedAt: at(6), netPnl: -300 },
    ]
    expect(buildBalanceSeries(50_000, trades)).toEqual([
      { date: "2026-10-05", balance: 50_400 },
      { date: "2026-10-06", balance: 50_100 },
    ])
  })

  it("has no point without any trade", () => {
    expect(buildBalanceSeries(50_000, [])).toEqual([])
  })
})

describe("sumBalances", () => {
  it("adds the accounts, carrying each balance forward and starting from its initial balance", () => {
    const total = sumBalances([
      { initialBalance: 1_000, points: [{ date: "2026-10-05", balance: 1_100 }] },
      { initialBalance: 2_000, points: [{ date: "2026-10-06", balance: 1_900 }] },
    ])
    expect(total).toEqual([
      { date: "2026-10-05", balance: 3_100 }, // 1100 + 2000
      { date: "2026-10-06", balance: 3_000 }, // 1100 + 1900
    ])
  })

  it("has no point without any account", () => {
    expect(sumBalances([])).toEqual([])
  })
})

describe("clipToPeriod", () => {
  it("keeps the days inside the bounds, both included", () => {
    const points = [{ date: "2026-10-05" }, { date: "2026-10-06" }, { date: "2026-10-07" }]
    expect(clipToPeriod(points, "2026-10-06", "2026-10-07")).toHaveLength(2)
    expect(clipToPeriod(points, null, null)).toHaveLength(3)
  })
})
