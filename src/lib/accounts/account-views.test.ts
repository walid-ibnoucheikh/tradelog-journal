import { describe, expect, it } from "vitest"
import { buildAccountView, riskLevel, riskScore, summarizeAccounts } from "./account-views"
import { computeAccountProgress, type AccountRules } from "./account-rules"

const rules = (overrides: Partial<AccountRules> = {}): AccountRules => ({
  initialBalance: 50_000,
  profitTarget: 3_000,
  maxDrawdown: 2_000,
  drawdownType: "eod_trailing",
  consistencyPercent: null,
  drawdownLockLevel: null,
  dailyLossLimit: null,
  ...overrides,
})

/** A trade closed on an earlier day, so it settles the balance without being "today". */
const loss = (amount: number) => ({ closedAt: new Date("2026-10-01T15:00:00Z"), netPnl: -amount })
const now = new Date("2026-10-28T15:00:00Z")
const level = (r: AccountRules, trades: ReturnType<typeof loss>[]) =>
  riskLevel(computeAccountProgress(r, trades, now))

describe("riskLevel", () => {
  it("is ok with plenty of room, then watch, danger and breached as the margin shrinks", () => {
    expect(level(rules(), [])).toBe("ok")
    expect(level(rules(), [loss(1_100)])).toBe("watch") // 45 % left
    expect(level(rules(), [loss(1_600)])).toBe("danger") // 20 % left
    expect(level(rules(), [loss(2_000)])).toBe("breached")
  })

  it("cannot judge an account without a drawdown or daily loss rule", () => {
    expect(level(rules({ maxDrawdown: null }), [loss(500)])).toBe("none")
  })

  it("takes the daily loss into account when it is the tighter limit", () => {
    const today = { closedAt: new Date("2026-10-28T14:00:00Z"), netPnl: -900 }
    const progress = computeAccountProgress(rules({ dailyLossLimit: 1_000 }), [today], now)
    expect(riskLevel(progress)).toBe("danger") // 90 % of the daily limit used
    const over = { ...today, netPnl: -1_000 }
    expect(riskLevel(computeAccountProgress(rules({ dailyLossLimit: 1_000 }), [over], now))).toBe(
      "breached"
    )
  })
})

describe("riskScore", () => {
  it("ranks the riskiest first and accounts without rule last", () => {
    const score = (r: AccountRules, trades: ReturnType<typeof loss>[]) =>
      riskScore(computeAccountProgress(r, trades, now))
    const scores = [
      score(rules({ maxDrawdown: null }), []),
      score(rules(), []),
      score(rules(), [loss(1_600)]),
      score(rules(), [loss(2_500)]),
    ]
    expect([...scores].sort((a, b) => a - b)).toEqual([scores[3], scores[2], scores[1], scores[0]])
  })
})

const account = (overrides: Record<string, unknown> = {}) => ({
  id: "a1",
  name: "Apex 50K",
  firm: "Apex",
  type: "eval" as const,
  status: "active" as const,
  tradovateName: "APEX1",
  initialBalance: 50_000,
  fundedAt: null,
  endedAt: null,
  createdAt: new Date("2026-08-01T10:00:00Z"),
  lastImportedAt: new Date("2026-10-28T10:00:00Z"),
  profitTarget: 3_000,
  maxDrawdown: 2_000,
  drawdownType: "eod_trailing" as const,
  consistencyPercent: null,
  drawdownLockLevel: null,
  dailyLossLimit: null,
  ...overrides,
})
const empty = { trades: 0, fills: 0, fees: 0, transactions: 0 }
const money = { cost: 100, payouts: 0, net: -100, openedOn: "2026-08-05" }

describe("buildAccountView", () => {
  it("gathers balance, risk, today's P&L and the last trade, with dates as text", () => {
    const view = buildAccountView(
      account(),
      [loss(300), { closedAt: new Date("2026-10-28T14:00:00Z"), netPnl: 120 }],
      now,
      empty,
      money
    )
    expect(view.progress.balance).toBe(49_820)
    expect(view.todayPnl).toBe(120)
    expect(view.lastTradeAt).toBe("2026-10-28T14:00:00.000Z")
    expect(view.createdAt).toBe("2026-08-01T10:00:00.000Z")
    // The purchase day comes from the registry (first spending), not from the creation date.
    expect(view.openedOn).toBe("2026-08-05")
    expect(view.risk).toBe("ok")
    expect(view.importState).toBe("fresh")
    expect(view.lifetimeDays).toBeNull()
  })

  it("gives a finished account its lifetime from the first spending", () => {
    const view = buildAccountView(
      account({ status: "blown", endedAt: "2026-09-14" }),
      [],
      now,
      empty,
      money
    )
    expect(view.lifetimeDays).toBe(40)
  })

  it("flags an account that was never imported", () => {
    const view = buildAccountView(account({ lastImportedAt: null }), [], now, empty, money)
    expect(view.importState).toBe("never")
    expect(view.lastTradeAt).toBeNull()
  })
})

describe("summarizeAccounts", () => {
  it("adds balances and today's P&L and counts what needs attention", () => {
    const views = [
      buildAccountView(account(), [loss(1_700)], now, empty, money), // danger
      buildAccountView(
        account({ id: "a2", maxDrawdown: null, lastImportedAt: null }),
        [],
        now,
        empty,
        money
      ), // unmeasured, never imported
      buildAccountView(
        account({ id: "a3", lastImportedAt: new Date("2026-10-20T10:00:00Z") }),
        [],
        now,
        empty,
        money
      ), // stale
    ]
    expect(summarizeAccounts(views)).toMatchObject({
      count: 3,
      balance: 148_300,
      atRisk: 1,
      unmeasured: 1,
      staleImports: 1,
      neverImported: 1,
      todayPnl: 0,
    })
  })
})
