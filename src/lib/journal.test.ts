import { describe, expect, it } from "vitest"
import { summarizeDay, type JournalTrade } from "./journal"

const trade = (minute: number, gross: number, commission: number, quantity = 1): JournalTrade => ({
  closedAt: new Date(Date.UTC(2026, 9, 15, 14, minute)),
  grossPnl: gross,
  commission,
  netPnl: Math.round((gross - commission) * 100) / 100,
  quantity,
})

describe("summarizeDay", () => {
  it("totals the day and builds the intraday curve in closing order", () => {
    // Given out of order on purpose.
    const day = summarizeDay("2026-10-15", [
      trade(30, -50, 1, 2),
      trade(10, 200, 1.5, 3),
      trade(50, 1, 1, 1),
    ])
    expect(day).toMatchObject({
      date: "2026-10-15",
      trades: 3,
      wins: 1,
      losses: 1,
      winRate: 50,
      netPnl: 147.5,
      grossPnl: 151,
      commissions: 3.5,
      volume: 6,
    })
    expect(day.curve).toEqual([0, 198.5, 147.5, 147.5])
    expect(day.profitFactor).toBeCloseTo(198.5 / 51, 5)
  })

  it("has no profit factor or win rate when there is no loss or no decided trade", () => {
    const winOnly = summarizeDay("2026-10-15", [trade(1, 10, 1)])
    expect(winOnly.profitFactor).toBeNull()
    expect(winOnly.winRate).toBe(100)
    expect(summarizeDay("2026-10-15", [trade(1, 1, 1)]).winRate).toBeNull()
  })

  it("leaves break-even trades out of the winners and losers", () => {
    const day = summarizeDay("2026-10-15", [
      { ...trade(1, 100, 1), status: "win" },
      { ...trade(2, 15, 1), status: "be" },
      { ...trade(3, -50, 1), status: "loss" },
    ])
    expect(day).toMatchObject({ trades: 3, wins: 1, losses: 1, winRate: 50 })
  })
})
