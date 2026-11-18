import { describe, expect, it } from "vitest"
import { computeScore } from "./score"
import { computeStats } from "./stats"

// October 2026 is on EDT (UTC-4): 15:00Z is 11:00 in New York, inside the session of that day.
const trade = (day: number, netPnl: number) => ({
  closedAt: new Date(Date.UTC(2026, 9, day, 15)),
  openedAt: new Date(Date.UTC(2026, 9, day, 14)),
  netPnl,
})

const score = (trades: ReturnType<typeof trade>[]) => computeScore(computeStats(trades))

describe("computeScore", () => {
  it("is null without any trade", () => {
    expect(score([])).toBeNull()
  })

  it("scores a steady, profitable record high", () => {
    // 5 winning days of 200 each, one small loss: no day weighs on the result.
    const result = score([
      trade(1, 200),
      trade(2, 200),
      trade(5, 200),
      trade(6, 200),
      trade(7, 200),
      trade(8, -50),
    ])!
    const byKey = Object.fromEntries(result.metrics.map((m) => [m.key, m.score]))
    expect(byKey.profitFactor).toBe(100) // 1000 / 50 = 20, capped
    expect(byKey.avgWinLoss).toBe(100)
    expect(byKey.consistency).toBeGreaterThan(75)
    expect(result.total).toBeGreaterThan(75)
    expect(result.total).toBeLessThanOrEqual(100)
  })

  it("scores a losing record at the bottom on the profit-based notes", () => {
    const result = score([trade(1, -100), trade(2, -100), trade(5, 40)])!
    const byKey = Object.fromEntries(result.metrics.map((m) => [m.key, m.score]))
    expect(byKey.recovery).toBe(0)
    expect(byKey.drawdown).toBe(0)
    expect(byKey.consistency).toBe(0)
    expect(result.total).toBeLessThan(25)
  })

  it("gives 0 on consistency when one day is the whole result", () => {
    const result = score([trade(1, 500), trade(2, -20), trade(5, -30)])!
    expect(result.metrics.find((m) => m.key === "consistency")!.score).toBe(0)
  })

  it("scores every note between 0 and 100 and the total as their mean", () => {
    const result = score([trade(1, 120), trade(2, -80), trade(5, 60), trade(6, -10)])!
    for (const metric of result.metrics) {
      expect(metric.score).toBeGreaterThanOrEqual(0)
      expect(metric.score).toBeLessThanOrEqual(100)
    }
    const mean = result.metrics.reduce((sum, m) => sum + m.score, 0) / result.metrics.length
    expect(result.total).toBeCloseTo(mean, 1)
  })
})
