import { describe, expect, it } from "vitest"
import { findBreach, type AccountRules } from "./account-rules"
import { accountSuggestions, type SuggestionAccount } from "./suggestions"

const eod: AccountRules = {
  initialBalance: 50_000,
  profitTarget: null,
  maxDrawdown: 2_500,
  drawdownType: "eod_trailing",
  drawdownLockLevel: null,
  dailyLossLimit: null,
  consistencyPercent: null,
}

// October 2026 is on EDT (UTC-4): 14:00Z is 10:00 in New York, the same trading day.
const trade = (day: number, netPnl: number, hourUtc = 14) => ({
  closedAt: new Date(Date.UTC(2026, 9, day, hourUtc)),
  netPnl,
})

describe("findBreach", () => {
  it("finds nothing without a max drawdown or while the balance stays above the threshold", () => {
    expect(findBreach({ ...eod, maxDrawdown: null }, [trade(5, -9000)])).toBeNull()
    expect(findBreach(eod, [trade(5, -1000), trade(6, 500)])).toBeNull()
  })

  it("reports the day of the trade that reaches the threshold", () => {
    // 50,000 - 2,500 = 47,500: reached by the second trade of the 7th.
    const breach = findBreach(eod, [
      trade(5, -1000),
      trade(6, -800),
      trade(7, -400, 14),
      trade(7, -300, 15),
    ])
    expect(breach).toEqual({ day: "2026-10-07", balance: 47_500, threshold: 47_500 })
  })

  it("trails the best end of session for EOD: a gain only counts once its session is over", () => {
    // +2,000 on the 5th: the next sessions' threshold is 49,500, so -2,600 on the 6th (49,400) breaches it.
    expect(findBreach(eod, [trade(5, 2000), trade(6, -2600)])?.day).toBe("2026-10-06")
    // The same day the gain is made, the threshold has not moved yet: no breach at 49,000.
    expect(findBreach(eod, [trade(5, 2000, 14), trade(5, -3000, 15)])).toBeNull()
  })

  it("trails the best balance after any trade for intraday", () => {
    const intraday = { ...eod, drawdownType: "intraday_trailing" as const }
    expect(findBreach(intraday, [trade(5, 2000, 14), trade(5, -2500, 15)])).toEqual({
      day: "2026-10-05",
      balance: 49_500,
      threshold: 49_500,
    })
  })

  it("never lets the threshold rise above the lock level", () => {
    const locked = { ...eod, drawdownLockLevel: 50_000 }
    // Peak 60,000 would put the threshold at 57,500; locked, it stays at 50,000.
    expect(findBreach(locked, [trade(5, 10_000), trade(6, -5_000)])).toBeNull()
    expect(findBreach(locked, [trade(5, 10_000), trade(6, -10_000)])?.balance).toBe(50_000)
  })
})

const account = (over: Partial<SuggestionAccount> & { id: string }): SuggestionAccount => ({
  ...eod,
  name: over.id,
  firm: "Lucid",
  status: "active",
  notFoundAt: null,
  ...over,
})

describe("accountSuggestions", () => {
  const results = new Map([
    ["blown", [trade(5, -1000), trade(6, -1600)]], // breached on the 6th, last trade the 6th
    ["reset", [trade(5, -3000), trade(8, 400)]], // breached, but traded again later: probably reset
    ["fine", [trade(5, 300)]],
  ])

  it("suggests blown only when the last trade is the one that breached", () => {
    const list = accountSuggestions(
      [account({ id: "blown" }), account({ id: "reset" }), account({ id: "fine" })],
      results
    )
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({
      id: "blown",
      kind: "blown",
      day: "2026-10-06",
      lastTradeDay: "2026-10-06",
      missing: false,
    })
  })

  it("suggests an account the agent cannot find, and flags a blown one that is also missing", () => {
    const since = new Date("2026-11-03T10:00:00Z")
    const list = accountSuggestions(
      [account({ id: "fine", notFoundAt: since }), account({ id: "blown", notFoundAt: since })],
      results
    )
    expect(list.find((item) => item.id === "fine")).toMatchObject({
      kind: "missing",
      since: "2026-11-03",
    })
    expect(list.find((item) => item.id === "blown")).toMatchObject({ kind: "blown", missing: true })
  })

  it("ignores accounts that are already finished", () => {
    expect(accountSuggestions([account({ id: "blown", status: "blown" })], results)).toEqual([])
  })
})
