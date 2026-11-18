import { describe, expect, it } from "vitest"
import {
  applyPnlMode,
  buildBreakdown,
  buildOverview,
  durationBucket,
  parsePnlMode,
  parseView,
  weekStart,
  type ReportTrade,
} from "./reports"

/** `open` and `close` are UTC times; October 2026 is still on summer time (UTC-4 in New York). */
function trade(open: string, close: string, netPnl: number, extra: Partial<ReportTrade> = {}) {
  return {
    product: "MNQ",
    quantity: 1,
    grossPnl: netPnl + 1,
    netPnl,
    commission: 1,
    openedAt: new Date(open),
    closedAt: new Date(close),
    ...extra,
  } satisfies ReportTrade
}

const trades = [
  // 10:00 New York, 2 min, a win
  trade("2026-09-29T14:00:00Z", "2026-09-29T14:02:00Z", 100),
  // 10:30 New York, 10 min, a loss
  trade("2026-09-30T14:30:00Z", "2026-09-30T14:40:00Z", -40),
  // 09:30 New York, 20 min, a win; same trading day as the next one
  trade("2026-10-01T13:30:00Z", "2026-10-01T13:50:00Z", 60, { product: "NQ", quantity: 2 }),
  // 15:00 New York, 1 min 30 s, a loss
  trade("2026-10-01T19:00:00Z", "2026-10-01T19:01:30Z", -90),
]

describe("buildOverview", () => {
  const overview = buildOverview(trades)

  it("totals the trades and fees", () => {
    expect(overview.totalPnl).toBe(30)
    expect(overview.commissions).toBe(4)
    expect(overview.avgTradePnl).toBe(7.5)
  })

  it("finds the biggest win and loss of a trade and of a day", () => {
    expect(overview.largestWin).toBe(100)
    expect(overview.largestLoss).toBe(-90)
    // Days: 09-29 = 100, 09-30 = -40, 10-01 = -30.
    expect(overview.largestWinningDay).toBe(100)
    expect(overview.largestLosingDay).toBe(-40)
    expect(overview.avgDailyPnl).toBe(10)
  })

  it("gives the best, worst and average month over the months that have trades", () => {
    expect(overview.months).toEqual([
      { month: "2026-09", pnl: 60 },
      { month: "2026-10", pnl: -30 },
    ])
    expect(overview.bestMonth).toEqual({ month: "2026-09", pnl: 60 })
    expect(overview.worstMonth).toEqual({ month: "2026-10", pnl: -30 })
    expect(overview.avgPerMonth).toBe(15)
  })

  it("averages the time in a trade, overall and for winners and losers", () => {
    const minute = 60_000
    expect(overview.avgHold.all).toBe(((2 + 10 + 20 + 1.5) * minute) / 4)
    expect(overview.avgHold.winning).toBe(11 * minute)
    expect(overview.avgHold.losing).toBe(5.75 * minute)
  })

  it("returns empty values for no trade", () => {
    const empty = buildOverview([])
    expect(empty.bestMonth).toBeNull()
    expect(empty.avgDailyPnl).toBeNull()
    expect(empty.largestWin).toBe(0)
    expect(empty.avgHold.all).toBeNull()
  })
})

describe("applyPnlMode", () => {
  it("counts the P&L before fees in gross mode and leaves net mode untouched", () => {
    expect(applyPnlMode(trades, "net")).toBe(trades)
    expect(buildOverview(applyPnlMode(trades, "gross")).totalPnl).toBe(34)
  })

  it("reads the mode from the address, net by default", () => {
    expect(parsePnlMode("gross")).toBe("gross")
    expect(parsePnlMode(["gross"])).toBe("gross")
    expect(parsePnlMode(undefined)).toBe("net")
    expect(parsePnlMode("autre")).toBe("net")
  })
})

describe("buildBreakdown", () => {
  it("groups by trading day", () => {
    const rows = buildBreakdown("day", trades)
    expect(rows.map((row) => [row.key, row.trades, row.pnl])).toEqual([
      ["2026-09-29", 1, 100],
      ["2026-09-30", 1, -40],
      ["2026-10-01", 2, -30],
    ])
  })

  it("groups by week, starting on Monday", () => {
    expect(weekStart("2026-10-01")).toBe("2026-09-28")
    expect(weekStart("2026-10-04")).toBe("2026-09-28")
    expect(weekStart("2026-10-05")).toBe("2026-10-05")
    const rows = buildBreakdown("week", trades)
    expect(rows.map((row) => [row.key, row.trades])).toEqual([["2026-09-28", 4]])
  })

  it("groups by month", () => {
    expect(buildBreakdown("month", trades).map((row) => [row.key, row.pnl])).toEqual([
      ["2026-09", 60],
      ["2026-10", -30],
    ])
  })

  it("groups by opening hour in New York time, in order", () => {
    expect(buildBreakdown("time", trades).map((row) => [row.label, row.pnl])).toEqual([
      ["09:00", 60],
      ["10:00", 60],
      ["15:00", -90],
    ])
  })

  it("groups by time in the trade", () => {
    expect(buildBreakdown("duration", trades).map((row) => [row.label, row.trades])).toEqual([
      ["1 – 5 min", 2],
      ["5 – 15 min", 1],
      ["15 – 30 min", 1],
    ])
  })

  it("groups by instrument and adds up volume, wins and fees", () => {
    const [mnq, nq] = buildBreakdown("instrument", trades)
    expect(mnq).toMatchObject({ key: "MNQ", trades: 3, volume: 3, wins: 1, losses: 2, pnl: -30 })
    expect(nq).toMatchObject({ key: "NQ", trades: 1, volume: 2, winRate: 100, commissions: 1 })
  })

  it("computes win rate, average and profit factor of a group", () => {
    const [row] = buildBreakdown("month", [trades[0], trades[1]])
    expect(row.winRate).toBe(50)
    expect(row.avgPnl).toBe(30)
    expect(row.profitFactor).toBe(2.5)
  })
})

describe("durationBucket and parseView", () => {
  it("puts a trade in the first bucket it is shorter than", () => {
    expect(durationBucket(30_000).label).toBe("< 1 min")
    expect(durationBucket(60_000).label).toBe("1 – 5 min")
    expect(durationBucket(2 * 3_600_000).label).toBe("> 1 h")
  })

  it("accepts only known views", () => {
    expect(parseView("week")).toBe("week")
    expect(parseView("tags")).toBeNull()
  })
})
