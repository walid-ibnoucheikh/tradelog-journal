import { describe, expect, it } from "vitest"
import { computeAccountProgress, type AccountRules } from "./account-rules"

const rules: AccountRules = {
  initialBalance: 50_000,
  profitTarget: 3_000,
  maxDrawdown: 2_500,
  drawdownType: "eod_trailing",
  drawdownLockLevel: null,
  dailyLossLimit: 1_000,
  consistencyPercent: null,
}

// October 2026 is on EDT (UTC-4), so 14:00Z is 10:00 in New York.
const at = (day: number, hourUtc = 14) => new Date(Date.UTC(2026, 9, day, hourUtc))
const trade = (day: number, netPnl: number, hourUtc = 14) => ({
  closedAt: at(day, hourUtc),
  netPnl,
})
// Thursday 15 October, 11:00 in New York: that session is still running.
const now = at(15, 15)

describe("computeAccountProgress balance and target", () => {
  it("adds every trade to the initial balance and measures the target", () => {
    const result = computeAccountProgress(rules, [trade(13, 1000), trade(14, -400)], now)
    expect(result.balance).toBe(50_600)
    expect(result.profit).toBe(600)
    expect(result.target).toEqual({ amount: 3000, remaining: 2400, percent: 20, reached: false })
  })

  it("caps the target progress at 100% and reports it reached", () => {
    const result = computeAccountProgress(rules, [trade(13, 3500)], now)
    expect(result.target).toMatchObject({ percent: 100, remaining: 0, reached: true })
  })

  it("has no target, drawdown or daily limit when the account has no such rule", () => {
    const bare: AccountRules = {
      ...rules,
      profitTarget: null,
      maxDrawdown: null,
      dailyLossLimit: null,
      consistencyPercent: null,
    }
    const result = computeAccountProgress(bare, [trade(13, -200)], now)
    expect(result).toEqual({
      balance: 49_800,
      profit: -200,
      target: null,
      drawdown: null,
      dailyLoss: null,
      consistency: null,
    })
  })
})

describe("computeAccountProgress EOD trailing drawdown", () => {
  it("trails the highest end-of-day balance", () => {
    // Wednesday closes at 51,000, Thursday (today) loses 300 so far.
    const result = computeAccountProgress(rules, [trade(14, 1000), trade(15, -300)], now)
    expect(result.balance).toBe(50_700)
    expect(result.drawdown).toMatchObject({
      threshold: 48_500,
      distance: 2_200,
      percentRemaining: 88,
      breached: false,
      locked: false,
    })
  })

  it("does not let today's gains raise the threshold before the day ends", () => {
    const result = computeAccountProgress(rules, [trade(14, 1000), trade(15, 2000)], now)
    expect(result.drawdown).toMatchObject({ threshold: 48_500, distance: 4_500 })
  })

  it("keeps the peak when the account falls back after it", () => {
    const result = computeAccountProgress(rules, [trade(13, 1000), trade(14, -800)], now)
    expect(result.drawdown).toMatchObject({ threshold: 48_500, distance: 1_700 })
  })

  it("stops the threshold at the lock level", () => {
    const locked = { ...rules, drawdownLockLevel: 50_100 }
    const result = computeAccountProgress(locked, [trade(13, 4000)], now)
    // Peak 54,000 would give 51,500; the lock holds it at 50,100.
    expect(result.drawdown).toMatchObject({ threshold: 50_100, locked: true })
  })

  it("reports a breach when the balance reaches the threshold", () => {
    const result = computeAccountProgress(rules, [trade(14, -2500)], now)
    expect(result.drawdown).toMatchObject({ distance: 0, percentRemaining: 0, breached: true })
  })

  it("counts an evening trade in the next session, which is still running", () => {
    // Wednesday 18:30 New York belongs to Thursday's session: no end-of-day peak yet.
    const result = computeAccountProgress(rules, [trade(14, 1000, 22)], now)
    expect(result.drawdown).toMatchObject({ threshold: 47_500, distance: 3_500 })
  })
})

describe("computeAccountProgress intraday drawdown", () => {
  const intraday: AccountRules = { ...rules, drawdownType: "intraday_trailing" }

  it("rises with the best balance after any closed trade, today's included", () => {
    // Today: +1000 then -300. The balance peaked at 51,000 during the session, now 50,700.
    const result = computeAccountProgress(intraday, [trade(15, 1000, 14), trade(15, -300, 15)], now)
    expect(result.drawdown).toMatchObject({
      threshold: 48_500,
      distance: 2_200,
      risesAtSessionEnd: false,
    })
  })

  it("keeps the peak after a loss: the threshold never goes back down", () => {
    const result = computeAccountProgress(intraday, [trade(13, 2000), trade(14, -1500)], now)
    expect(result.balance).toBe(50_500)
    expect(result.drawdown).toMatchObject({ threshold: 49_500, distance: 1_000 })
  })

  it("stops rising at the lock level", () => {
    const result = computeAccountProgress(
      { ...intraday, drawdownLockLevel: 50_100 },
      [trade(13, 5000)],
      now
    )
    expect(result.drawdown).toMatchObject({ threshold: 50_100, locked: true })
  })
})

describe("computeAccountProgress EOD threshold rising at the end of the session", () => {
  it("announces a rise when today's balance is above the end-of-day peak", () => {
    // Yesterday closed at 50,000 (peak), today is up 1,000: the threshold stays until the session ends.
    const result = computeAccountProgress(rules, [trade(15, 1000)], now)
    expect(result.drawdown).toMatchObject({ threshold: 47_500, risesAtSessionEnd: true })
  })

  it("does not announce a rise once the threshold is at the lock level", () => {
    const result = computeAccountProgress(
      { ...rules, drawdownLockLevel: 47_500 },
      [trade(15, 1000)],
      now
    )
    expect(result.drawdown).toMatchObject({ locked: false, risesAtSessionEnd: false })
  })
})

describe("computeAccountProgress consistency rule", () => {
  const limited: AccountRules = { ...rules, consistencyPercent: 40 }

  it("measures the best day against the total profit and what is left to earn", () => {
    // One day of 435 is 100% of a 435 profit; at 40% the profit must reach 1,087.50: 652.50 more.
    const result = computeAccountProgress(limited, [trade(13, 435)], now)
    expect(result.consistency).toEqual({
      limitPercent: 40,
      bestDay: 435,
      share: 100,
      compliant: false,
      leftToEarn: 652.5,
    })
  })

  it("is compliant when no day weighs more than the limit", () => {
    const result = computeAccountProgress(
      limited,
      [trade(12, 300), trade(13, 300), trade(14, 400)],
      now
    )
    expect(result.consistency).toMatchObject({ share: 40, compliant: true, leftToEarn: 0 })
  })

  it("has no share while the account is not in profit", () => {
    const result = computeAccountProgress(limited, [trade(13, -200)], now)
    expect(result.consistency).toMatchObject({ share: null, compliant: true, bestDay: 0 })
  })

  it("has no consistency without the rule", () => {
    expect(computeAccountProgress(rules, [trade(13, 435)], now).consistency).toBeNull()
  })
})

describe("computeAccountProgress daily loss limit", () => {
  it("measures what is left of today's allowance", () => {
    const result = computeAccountProgress(rules, [trade(14, -900), trade(15, -300)], now)
    expect(result.dailyLoss).toEqual({
      limit: 1000,
      lostToday: 300,
      remaining: 700,
      breached: false,
    })
  })

  it("is untouched by a winning day, and breached once the limit is lost", () => {
    expect(computeAccountProgress(rules, [trade(15, 400)], now).dailyLoss).toMatchObject({
      lostToday: 0,
      remaining: 1000,
    })
    expect(computeAccountProgress(rules, [trade(15, -1000)], now).dailyLoss).toMatchObject({
      remaining: 0,
      breached: true,
    })
  })
})
