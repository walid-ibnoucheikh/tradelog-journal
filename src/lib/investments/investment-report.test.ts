import { describe, expect, it } from "vitest"
import {
  buildInvestmentReport,
  type ReportAccount,
  type ReportTransaction,
} from "./investment-report"

const account = (overrides: Partial<ReportAccount> & Pick<ReportAccount, "id">): ReportAccount => ({
  name: overrides.id,
  firm: "Apex",
  type: "eval",
  status: "active",
  fundedAt: null,
  endedAt: null,
  createdAt: new Date("2026-08-01T10:00:00Z"),
  ...overrides,
})

const tx = (
  day: string,
  type: ReportTransaction["type"],
  amount: number,
  accountId: string | null,
  firm = "Apex"
): ReportTransaction => ({ day, type, amount, accountId, firm })

// A passed its evaluation and got paid; B was blown after a reset; C is still in evaluation.
const accounts = [
  account({ id: "A", type: "funded", fundedAt: "2026-09-10" }),
  account({ id: "B", status: "blown", endedAt: "2026-09-20" }),
  account({ id: "C", firm: "Tradeify" }),
]
const transactions = [
  tx("2026-09-01", "evaluation", 37.5, "A"),
  tx("2026-09-12", "activation", 100, "A"),
  tx("2026-10-20", "payout", 500, "A"),
  tx("2026-09-05", "evaluation", 37.5, "B"),
  tx("2026-09-12", "reset", 80, "B"),
  tx("2026-10-01", "evaluation", 40, "C", "Tradeify"),
  tx("2026-10-02", "subscription", 20, null, "apex"),
]
const report = buildInvestmentReport({
  accounts,
  transactions,
  tradingPnl: new Map([
    ["A", 1234.5],
    ["B", -2500],
  ]),
})

describe("buildInvestmentReport totals", () => {
  it("computes spending, payouts, net and ROI", () => {
    expect(report).toMatchObject({ cost: 315, payouts: 500, net: 185 })
    expect(report.roi).toBeCloseTo((185 / 315) * 100, 6)
  })

  it("has no ROI before anything is spent", () => {
    const empty = buildInvestmentReport({ accounts: [], transactions: [], tradingPnl: new Map() })
    expect(empty).toMatchObject({ cost: 0, payouts: 0, net: 0, roi: null, passRate: null })
    expect(empty.unlinked).toBeNull()
    expect(empty.accountRows).toEqual([])
  })
})

describe("buildInvestmentReport accounts", () => {
  it("counts accounts by status and evaluations by outcome", () => {
    expect(report.accounts).toEqual({ total: 3, active: 2, blown: 1, closed: 0, funded: 1 })
    expect(report.evaluations).toEqual({ passed: 1, failed: 1, inProgress: 1 })
    expect(report.passRate).toBe(50)
  })

  it("derives cost per funded account, payout per funded account and lifetime", () => {
    expect(report.costPerFundedAccount).toBe(315)
    expect(report.payoutPerFundedAccount).toBe(500)
    // B: first spend on 2026-09-05, blown on 2026-09-20.
    expect(report.averageLifetimeDays).toBe(15)
  })

  it("gives each account its own cost, payouts, net and trading P&L, active first", () => {
    expect(report.accountRows.map((row) => row.id)).toEqual(["C", "A", "B"])
    const byId = Object.fromEntries(report.accountRows.map((row) => [row.id, row]))
    expect(byId.A).toMatchObject({ cost: 137.5, payouts: 500, net: 362.5, tradingPnl: 1234.5 })
    expect(byId.B).toMatchObject({ cost: 117.5, payouts: 0, net: -117.5, openedOn: "2026-09-05" })
    expect(byId.C).toMatchObject({ cost: 40, net: -40, tradingPnl: 0 })
  })

  it("falls back to the creation day when nothing was spent on an account", () => {
    const [row] = buildInvestmentReport({
      accounts: [account({ id: "Z" })],
      transactions: [],
      tradingPnl: new Map(),
    }).accountRows
    expect(row.openedOn).toBe("2026-08-01")
  })

  it("keeps blown evaluations out of the pass rate when closed instead", () => {
    const closed = buildInvestmentReport({
      accounts: [account({ id: "X", status: "closed", endedAt: "2026-09-01" })],
      transactions: [],
      tradingPnl: new Map(),
    })
    expect(closed.passRate).toBeNull()
    expect(closed.averageLifetimeDays).toBeNull()
  })
})

describe("buildInvestmentReport firms and unlinked spending", () => {
  it("reports transactions without an account separately", () => {
    expect(report.unlinked).toEqual({ cost: 20, payouts: 0, net: -20 })
  })

  it("groups firms case-insensitively and ranks them by net", () => {
    expect(report.firmRows).toEqual([
      {
        firm: "Apex",
        accounts: 2,
        funded: 1,
        blown: 1,
        cost: 275,
        payouts: 500,
        net: 225,
        roi: (225 / 275) * 100,
      },
      {
        firm: "Tradeify",
        accounts: 1,
        funded: 0,
        blown: 0,
        cost: 40,
        payouts: 0,
        net: -40,
        roi: -100,
      },
    ])
  })
})

describe("buildInvestmentReport outside prop firms", () => {
  const accounts = [account({ id: "a", type: "funded" })]
  const transactions = [
    tx("2026-09-01", "evaluation", 100, "a"),
    tx("2026-10-01", "payout", 500, "a"),
    tx("2026-09-05", "tools", 14.95, null, "TradingView"),
    tx("2026-10-05", "tools", 14.95, null, "tradingview"),
    tx("2026-09-10", "education", 200, null, "Mentor Discord"),
  ]
  const report = buildInvestmentReport({ accounts, transactions, tradingPnl: new Map() })

  it("counts courses and tools in the totals", () => {
    expect(report.cost).toBe(329.9)
    expect(report.net).toBe(170.1)
  })

  it("keeps them out of firms, unlinked spending and the cost per funded account", () => {
    expect(report.firmRows.map((row) => row.firm)).toEqual(["Apex"])
    expect(report.unlinked).toBeNull()
    expect(report.costPerFundedAccount).toBe(100)
  })

  it("lists each provider once with its total, biggest first, and the share of spending", () => {
    expect(report.outsidePropFirm?.rows).toEqual([
      { provider: "Mentor Discord", type: "education", cost: 200, payments: 1 },
      { provider: "TradingView", type: "tools", cost: 29.9, payments: 2 },
    ])
    expect(report.outsidePropFirm?.cost).toBe(229.9)
    expect(report.outsidePropFirm?.share).toBeCloseTo(69.69, 1)
  })

  it("has nothing outside prop firms when there is no such spending", () => {
    const plain = buildInvestmentReport({
      accounts,
      transactions: transactions.slice(0, 2),
      tradingPnl: new Map(),
    })
    expect(plain.outsidePropFirm).toBeNull()
  })
})

describe("buildInvestmentReport over a period", () => {
  const accounts = [
    account({ id: "old", name: "Ancien", createdAt: new Date("2025-03-01T10:00:00Z") }),
    account({ id: "new", name: "Récent", createdAt: new Date("2026-02-01T10:00:00Z") }),
  ]
  const transactions = [
    tx("2025-03-05", "evaluation", 100, "old"),
    tx("2025-11-20", "payout", 400, "old"),
    tx("2026-02-03", "evaluation", 50, "new"),
    tx("2026-04-10", "tools", 15, null, "TradingView"),
  ]
  const in2026 = { from: "2026-01-01", to: "2026-12-31" }
  const run = (period: { from: string; to: string } | null) =>
    buildInvestmentReport({ accounts, transactions, tradingPnl: new Map(), period })

  it("changes nothing without a period", () => {
    const all = run(null)
    expect(all.cost).toBe(165)
    expect(all.accountRows).toHaveLength(2)
  })

  it("counts only the money of the period", () => {
    const report = run(in2026)
    expect(report.cost).toBe(65)
    expect(report.payouts).toBe(0)
    expect(report.net).toBe(-65)
    expect(report.outsidePropFirm?.cost).toBe(15)
  })

  it("keeps the accounts that touch the period and drops the others", () => {
    const report = run(in2026)
    expect(report.accountRows.map((row) => row.id)).toEqual(["new"])
    expect(report.accounts.total).toBe(1)
  })

  it("keeps an older account that had a transaction in the period, with its true opening day", () => {
    const report = run({ from: "2025-11-01", to: "2025-12-31" })
    const [row] = report.accountRows
    expect(row).toMatchObject({ id: "old", cost: 0, payouts: 400, openedOn: "2025-03-05" })
  })
})
