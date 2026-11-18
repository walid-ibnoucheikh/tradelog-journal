import { dayKey } from "../trading/stats"
import { daysBetween } from "../investments/investment-report"
import type { AccountStatus } from "../investments/investments"
import { computeAccountProgress, type AccountProgress, type DrawdownType } from "./account-rules"
import { importState } from "./import-freshness"

/** How worried to be about an account, from its drawdown margin and its daily loss. */
export type RiskLevel = "breached" | "danger" | "watch" | "ok" | "none"

/** Margin left (as a share of the max drawdown) under which an account is in danger, then to watch. */
export const DANGER_MARGIN = 25
export const WATCH_MARGIN = 50

const percentUsed = (loss: NonNullable<AccountProgress["dailyLoss"]>) =>
  Math.min(100, (loss.lostToday / loss.limit) * 100)

/** The tightest remaining room, from 0 (nothing left) to 100 (untouched), or null with no rule to measure. */
function roomLeft(progress: AccountProgress): number | null {
  const rooms = [
    progress.drawdown?.percentRemaining,
    progress.dailyLoss ? 100 - percentUsed(progress.dailyLoss) : undefined,
  ].filter((room): room is number => room !== undefined)
  return rooms.length === 0 ? null : Math.min(...rooms)
}

export function riskLevel(progress: AccountProgress): RiskLevel {
  if (progress.drawdown?.breached || progress.dailyLoss?.breached) return "breached"
  const room = roomLeft(progress)
  if (room === null) return "none"
  if (room <= DANGER_MARGIN) return "danger"
  if (room <= WATCH_MARGIN) return "watch"
  return "ok"
}

/** Sort key: the riskiest accounts first; accounts without a rule to measure go last. */
export function riskScore(progress: AccountProgress): number {
  if (progress.drawdown?.breached || progress.dailyLoss?.breached) return -1
  return roomLeft(progress) ?? 101
}

export interface AccountRulesView {
  profitTarget: number | null
  maxDrawdown: number | null
  drawdownType: DrawdownType
  drawdownLockLevel: number | null
  dailyLossLimit: number | null
  consistencyPercent: number | null
}

/** Everything the accounts page shows about one account, as plain values a client component can take. */
export interface AccountView {
  id: string
  name: string
  firm: string
  type: "eval" | "funded"
  status: AccountStatus
  tradovateName: string
  initialBalance: number
  fundedAt: string | null
  endedAt: string | null
  /** Purchase day: the first spending on the account (YYYY-MM-DD), else the day it was created. */
  openedOn: string
  /** ISO date-time strings: Dates do not survive the trip to the browser unchanged. */
  createdAt: string
  lastImportedAt: string | null
  lastTradeAt: string | null
  rules: AccountRulesView
  progress: AccountProgress
  risk: RiskLevel
  riskScore: number
  /** Net P&L of the current trading session. */
  todayPnl: number
  importState: "never" | "fresh" | "stale"
  contents: { trades: number; fills: number; fees: number; transactions: number }
  /** Real money spent on and received from the account (investments registry). */
  money: { cost: number; payouts: number; net: number }
  /** Days from the first spending (or creation) to the end of a finished account. */
  lifetimeDays: number | null
}

interface AccountInput {
  id: string
  name: string
  firm: string
  type: "eval" | "funded"
  status: AccountStatus
  tradovateName: string
  initialBalance: number
  fundedAt: string | null
  endedAt: string | null
  createdAt: Date
  lastImportedAt: Date | null
  profitTarget: number | null
  maxDrawdown: number | null
  drawdownType: DrawdownType
  drawdownLockLevel: number | null
  dailyLossLimit: number | null
  consistencyPercent: number | null
}

const round2 = (value: number) => Math.round(value * 100) / 100

export function buildAccountView(
  account: AccountInput,
  trades: { closedAt: Date; netPnl: number }[],
  now: Date,
  contents: AccountView["contents"],
  money: { cost: number; payouts: number; net: number; openedOn: string }
): AccountView {
  const progress = computeAccountProgress(account, trades, now)
  const today = dayKey(now)
  const last = trades.reduce<Date | null>(
    (latest, trade) => (latest === null || trade.closedAt > latest ? trade.closedAt : latest),
    null
  )
  return {
    id: account.id,
    name: account.name,
    firm: account.firm,
    type: account.type,
    status: account.status,
    tradovateName: account.tradovateName,
    initialBalance: account.initialBalance,
    fundedAt: account.fundedAt,
    endedAt: account.endedAt,
    openedOn: money.openedOn,
    createdAt: account.createdAt.toISOString(),
    lastImportedAt: account.lastImportedAt?.toISOString() ?? null,
    lastTradeAt: last?.toISOString() ?? null,
    rules: {
      profitTarget: account.profitTarget,
      maxDrawdown: account.maxDrawdown,
      drawdownType: account.drawdownType,
      drawdownLockLevel: account.drawdownLockLevel,
      dailyLossLimit: account.dailyLossLimit,
      consistencyPercent: account.consistencyPercent,
    },
    progress,
    risk: riskLevel(progress),
    riskScore: riskScore(progress),
    todayPnl: round2(
      trades
        .filter((trade) => dayKey(trade.closedAt) === today)
        .reduce((sum, trade) => sum + trade.netPnl, 0)
    ),
    importState: importState(account.lastImportedAt, now).state,
    contents,
    money: { cost: money.cost, payouts: money.payouts, net: money.net },
    lifetimeDays: account.endedAt ? daysBetween(money.openedOn, account.endedAt) : null,
  }
}

export interface AccountsSummary {
  count: number
  balance: number
  /** Accounts in danger or past a limit. */
  atRisk: number
  /** Accounts with no drawdown or daily loss rule: their risk cannot be measured. */
  unmeasured: number
  todayPnl: number
  staleImports: number
  neverImported: number
}

export function summarizeAccounts(views: AccountView[]): AccountsSummary {
  return {
    count: views.length,
    balance: round2(views.reduce((sum, view) => sum + view.progress.balance, 0)),
    atRisk: views.filter((view) => view.risk === "breached" || view.risk === "danger").length,
    unmeasured: views.filter((view) => view.risk === "none").length,
    todayPnl: round2(views.reduce((sum, view) => sum + view.todayPnl, 0)),
    staleImports: views.filter((view) => view.importState === "stale").length,
    neverImported: views.filter((view) => view.importState === "never").length,
  }
}
