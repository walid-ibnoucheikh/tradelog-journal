import {
  isIncome,
  isOutsidePropFirm,
  type AccountStatus,
  type TransactionType,
} from "./investments"
import { inRange, type PeriodRange } from "./period"

export interface ReportAccount {
  id: string
  name: string
  firm: string
  type: "eval" | "funded"
  status: AccountStatus
  fundedAt: string | null
  endedAt: string | null
  createdAt: Date
}

export interface ReportTransaction {
  day: string
  firm: string
  accountId: string | null
  type: TransactionType
  amount: number
}

export interface Money {
  cost: number
  payouts: number
  /** Payouts minus costs. */
  net: number
}

export interface AccountRow extends Money {
  id: string
  name: string
  firm: string
  type: "eval" | "funded"
  status: AccountStatus
  fundedAt: string | null
  endedAt: string | null
  /** First day money was spent on the account, or the day it was created. */
  openedOn: string
  /** Net P&L of the trades on the account. Virtual money on an evaluation. */
  tradingPnl: number
}

export interface FirmRow extends Money {
  firm: string
  /** Net divided by what was spent with the firm, as a percentage; null when nothing was spent. */
  roi: number | null
  accounts: number
  funded: number
  blown: number
}

export interface ProviderRow {
  /** Provider as first written, e.g. "TradingView". */
  provider: string
  type: "education" | "tools"
  cost: number
  /** Number of payments, e.g. one per month for a subscription. */
  payments: number
}

/** Spending unrelated to a prop firm: courses, mentoring, tools and subscriptions. */
export interface OutsidePropFirm {
  cost: number
  /** Share of everything spent, as a percentage. */
  share: number
  rows: ProviderRow[]
}

export interface InvestmentReport extends Money {
  /** Return on what was spent, as a percentage; null when nothing was spent. */
  roi: number | null
  accounts: { total: number; active: number; blown: number; closed: number; funded: number }
  evaluations: { passed: number; failed: number; inProgress: number }
  /** Passed / (passed + failed), as a percentage; null until an evaluation has ended. */
  passRate: number | null
  /** Spending on prop firms (not courses or tools) divided by the number of funded accounts. */
  costPerFundedAccount: number | null
  /** Payouts divided by the number of funded accounts. */
  payoutPerFundedAccount: number | null
  /** Days between the first spend and the blow, averaged over blown accounts. */
  averageLifetimeDays: number | null
  accountRows: AccountRow[]
  /** Transactions not tied to an account; null when there are none. */
  unlinked: Money | null
  firmRows: FirmRow[]
  /** Courses, mentoring and tools; null when there is no such spending. */
  outsidePropFirm: OutsidePropFirm | null
}

const round2 = (value: number) => Math.round(value * 100) / 100

function money(transactions: ReportTransaction[]): Money {
  const cost = round2(
    transactions.filter((t) => !isIncome(t.type)).reduce((sum, t) => sum + t.amount, 0)
  )
  const payouts = round2(
    transactions.filter((t) => isIncome(t.type)).reduce((sum, t) => sum + t.amount, 0)
  )
  return { cost, payouts, net: round2(payouts - cost) }
}

export function daysBetween(from: string, to: string): number {
  const days = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000
  return Math.max(0, Math.round(days))
}

function buildOutsidePropFirm(
  transactions: ReportTransaction[],
  totalCost: number
): OutsidePropFirm | null {
  const outside = transactions.filter((t) => isOutsidePropFirm(t.type))
  if (outside.length === 0) return null

  // Providers are typed by hand: "tradingview" and "TradingView" are the same one.
  const rows = new Map<string, ProviderRow>()
  for (const t of outside) {
    const type = t.type as ProviderRow["type"]
    const key = `${type}:${t.firm.trim().toLowerCase()}`
    const row = rows.get(key) ?? { provider: t.firm.trim(), type, cost: 0, payments: 0 }
    row.cost = round2(row.cost + t.amount)
    row.payments += 1
    rows.set(key, row)
  }
  const cost = round2([...rows.values()].reduce((sum, row) => sum + row.cost, 0))
  return {
    cost,
    share: totalCost === 0 ? 0 : (cost / totalCost) * 100,
    rows: [...rows.values()].sort((a, b) => b.cost - a.cost),
  }
}

export function buildInvestmentReport({
  accounts: allAccounts,
  transactions: allTransactions,
  tradingPnl,
  period = null,
}: {
  accounts: ReportAccount[]
  transactions: ReportTransaction[]
  /** Net P&L of each account's trades, by account ID (already limited to the period). */
  tradingPnl: Map<string, number>
  /**
   * Limits the money to a period. Accounts stay in the report when they were created, funded or
   * ended in it, or had a transaction in it; their opening day still comes from all their history.
   */
  period?: PeriodRange | null
}): InvestmentReport {
  const transactions = allTransactions.filter((t) => inRange(t.day, period))
  const accounts = allAccounts.filter(
    (account) =>
      period === null ||
      [account.createdAt.toISOString().slice(0, 10), account.fundedAt, account.endedAt].some(
        (day) => day !== null && inRange(day, period)
      ) ||
      transactions.some((t) => t.accountId === account.id)
  )

  const accountRows: AccountRow[] = accounts
    .map((account) => {
      const own = transactions.filter((t) => t.accountId === account.id)
      const firstSpend = allTransactions
        .filter((t) => t.accountId === account.id && !isIncome(t.type))
        .map((t) => t.day)
        .sort()[0]
      return {
        id: account.id,
        name: account.name,
        firm: account.firm,
        type: account.type,
        status: account.status,
        fundedAt: account.fundedAt,
        endedAt: account.endedAt,
        openedOn: firstSpend ?? account.createdAt.toISOString().slice(0, 10),
        tradingPnl: round2(tradingPnl.get(account.id) ?? 0),
        ...money(own),
      }
    })
    .sort(
      (a, b) =>
        Number(a.status !== "active") - Number(b.status !== "active") ||
        b.openedOn.localeCompare(a.openedOn)
    )

  // Courses and tools count in the totals but belong to no firm and no funded account.
  const total = money(transactions)
  const propFirmTransactions = transactions.filter((t) => !isOutsidePropFirm(t.type))
  const propFirmMoney = money(propFirmTransactions)
  const unlinkedTransactions = propFirmTransactions.filter((t) => t.accountId === null)

  const funded = accounts.filter((a) => a.type === "funded").length
  const passed = accounts.filter((a) => a.fundedAt !== null).length
  const evaluations = accounts.filter((a) => a.type === "eval" && a.fundedAt === null)
  const failed = evaluations.filter((a) => a.status === "blown").length
  const inProgress = evaluations.filter((a) => a.status === "active").length

  const lifetimes = accountRows
    .filter((row) => row.status === "blown" && row.endedAt !== null)
    .map((row) => daysBetween(row.openedOn, row.endedAt!))

  // Firm names are typed by hand: "apex" and "Apex" are the same firm.
  const firms = new Map<string, string>()
  for (const name of [...accounts.map((a) => a.firm), ...propFirmTransactions.map((t) => t.firm)]) {
    const key = name.trim().toLowerCase()
    if (!firms.has(key)) firms.set(key, name.trim())
  }
  const sameFirm = (name: string, key: string) => name.trim().toLowerCase() === key
  const firmRows: FirmRow[] = [...firms.entries()]
    .map(([key, firm]) => {
      const own = accounts.filter((a) => sameFirm(a.firm, key))
      const cash = money(propFirmTransactions.filter((t) => sameFirm(t.firm, key)))
      return {
        firm,
        roi: cash.cost === 0 ? null : (cash.net / cash.cost) * 100,
        accounts: own.length,
        funded: own.filter((a) => a.type === "funded").length,
        blown: own.filter((a) => a.status === "blown").length,
        ...cash,
      }
    })
    .sort((a, b) => b.net - a.net)

  return {
    ...total,
    roi: total.cost === 0 ? null : (total.net / total.cost) * 100,
    accounts: {
      total: accounts.length,
      active: accounts.filter((a) => a.status === "active").length,
      blown: accounts.filter((a) => a.status === "blown").length,
      closed: accounts.filter((a) => a.status === "closed").length,
      funded,
    },
    evaluations: { passed, failed, inProgress },
    passRate: passed + failed === 0 ? null : (passed / (passed + failed)) * 100,
    costPerFundedAccount: funded === 0 ? null : round2(propFirmMoney.cost / funded),
    payoutPerFundedAccount: funded === 0 ? null : round2(total.payouts / funded),
    averageLifetimeDays:
      lifetimes.length === 0
        ? null
        : Math.round(lifetimes.reduce((sum, days) => sum + days, 0) / lifetimes.length),
    accountRows,
    unlinked: unlinkedTransactions.length > 0 ? money(unlinkedTransactions) : null,
    firmRows,
    outsidePropFirm: buildOutsidePropFirm(transactions, total.cost),
  }
}
