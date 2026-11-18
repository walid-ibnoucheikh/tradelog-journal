import { computeStats, dayKey, hourOfDay, type Stats } from "./trading/stats"
import type { TradeStatus } from "./trading/trade"

/** What the reports need from a trade (a `TradeRow` fits). */
export interface ReportTrade {
  product: string
  quantity: number
  grossPnl: number
  netPnl: number
  commission: number
  openedAt: Date
  closedAt: Date
  status?: TradeStatus
}

/** Whether the figures count the trades' P&L before or after fees. */
export type PnlMode = "net" | "gross"

export function parsePnlMode(value: string | string[] | undefined): PnlMode {
  return (Array.isArray(value) ? value[0] : value) === "gross" ? "gross" : "net"
}

/** The trades with `netPnl` set to the P&L of the chosen mode, so every stat follows the toggle. */
export function applyPnlMode<T extends ReportTrade>(trades: T[], mode: PnlMode): T[] {
  return mode === "gross" ? trades.map((trade) => ({ ...trade, netPnl: trade.grossPnl })) : trades
}

const round2 = (value: number) => Math.round(value * 100) / 100

const average = (values: number[]) =>
  values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length

const holdTime = (trade: ReportTrade) => trade.closedAt.getTime() - trade.openedAt.getTime()

const statusOf = (trade: ReportTrade): TradeStatus =>
  trade.status ?? (trade.netPnl > 0 ? "win" : trade.netPnl < 0 ? "loss" : "be")

export interface Overview {
  stats: Stats
  /** Trading months ("YYYY-MM") with their P&L, oldest first. */
  months: { month: string; pnl: number }[]
  bestMonth: { month: string; pnl: number } | null
  worstMonth: { month: string; pnl: number } | null
  /** Average over the months that have trades. */
  avgPerMonth: number | null
  totalPnl: number
  commissions: number
  /** Biggest single win and loss (0 when there is none). */
  largestWin: number
  largestLoss: number
  avgTradePnl: number | null
  largestWinningDay: number
  largestLosingDay: number
  avgDailyPnl: number | null
  /** Average time in a trade, in milliseconds; null when there is no such trade. */
  avgHold: { all: number | null; winning: number | null; losing: number | null }
}

export function buildOverview(trades: ReportTrade[]): Overview {
  const stats = computeStats(trades)

  const byMonth = new Map<string, number>()
  for (const day of stats.days) {
    const month = day.date.slice(0, 7)
    byMonth.set(month, (byMonth.get(month) ?? 0) + day.netPnl)
  }
  const months = [...byMonth.entries()].map(([month, pnl]) => ({ month, pnl: round2(pnl) }))
  const byPnl = [...months].sort((a, b) => a.pnl - b.pnl)

  const dayPnls = stats.days.map((day) => day.netPnl)
  const avgMonth = average(months.map((month) => month.pnl))
  const avgDay = average(dayPnls)
  const avgTrade = average(trades.map((trade) => trade.netPnl))

  return {
    stats,
    months,
    bestMonth: byPnl[byPnl.length - 1] ?? null,
    worstMonth: byPnl[0] ?? null,
    avgPerMonth: avgMonth === null ? null : round2(avgMonth),
    totalPnl: stats.netPnl,
    commissions: round2(trades.reduce((sum, trade) => sum + trade.commission, 0)),
    largestWin: Math.max(0, ...trades.map((trade) => trade.netPnl)),
    largestLoss: Math.min(0, ...trades.map((trade) => trade.netPnl)),
    avgTradePnl: avgTrade === null ? null : round2(avgTrade),
    largestWinningDay: Math.max(0, ...dayPnls),
    largestLosingDay: Math.min(0, ...dayPnls),
    avgDailyPnl: avgDay === null ? null : round2(avgDay),
    avgHold: {
      all: average(trades.map(holdTime)),
      winning: average(trades.filter((trade) => statusOf(trade) === "win").map(holdTime)),
      losing: average(trades.filter((trade) => statusOf(trade) === "loss").map(holdTime)),
    },
  }
}

export interface GroupRow {
  key: string
  label: string
  trades: number
  wins: number
  losses: number
  winRate: number | null
  pnl: number
  avgPnl: number
  profitFactor: number | null
  /** Contracts traded. */
  volume: number
  commissions: number
}

function summarize(key: string, label: string, trades: ReportTrade[]): GroupRow {
  const stats = computeStats(trades)
  return {
    key,
    label,
    trades: trades.length,
    wins: stats.wins,
    losses: stats.losses,
    winRate: stats.winRate,
    pnl: stats.netPnl,
    avgPnl: round2(stats.netPnl / trades.length),
    profitFactor: stats.profitFactor,
    volume: trades.reduce((sum, trade) => sum + trade.quantity, 0),
    commissions: round2(trades.reduce((sum, trade) => sum + trade.commission, 0)),
  }
}

/** Groups by a key, in the order given by `sortKeys` (or alphabetical), empty groups left out. */
function groupBy(
  trades: ReportTrade[],
  keyOf: (trade: ReportTrade) => string,
  labelOf: (key: string) => string,
  sortKeys: (a: string, b: string) => number = (a, b) => a.localeCompare(b)
): GroupRow[] {
  const groups = new Map<string, ReportTrade[]>()
  for (const trade of trades) {
    const key = keyOf(trade)
    groups.set(key, [...(groups.get(key) ?? []), trade])
  }
  return [...groups.keys()]
    .sort(sortKeys)
    .map((key) => summarize(key, labelOf(key), groups.get(key) ?? []))
}

export const VIEWS = ["day", "week", "month", "time", "duration", "instrument"] as const
export type View = (typeof VIEWS)[number]

export function parseView(value: string): View | null {
  return (VIEWS as readonly string[]).includes(value) ? (value as View) : null
}

/** Monday of the week a trading day (YYYY-MM-DD) falls in. */
export function weekStart(day: string): string {
  const [year, month, dayOfMonth] = day.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1, dayOfMonth))
  const sinceMonday = (date.getUTCDay() + 6) % 7
  return new Date(Date.UTC(year, month - 1, dayOfMonth - sinceMonday)).toISOString().slice(0, 10)
}

const MINUTE = 60_000

/** Time spent in a trade, in the order shown; a trade falls in the first bucket whose `below` it is under. */
export const DURATION_BUCKETS = [
  { key: "1", label: "< 1 min", below: MINUTE },
  { key: "2", label: "1 – 5 min", below: 5 * MINUTE },
  { key: "3", label: "5 – 15 min", below: 15 * MINUTE },
  { key: "4", label: "15 – 30 min", below: 30 * MINUTE },
  { key: "5", label: "30 min – 1 h", below: 60 * MINUTE },
  { key: "6", label: "> 1 h", below: Infinity },
] as const

export function durationBucket(milliseconds: number) {
  return DURATION_BUCKETS.find((bucket) => milliseconds < bucket.below) ?? DURATION_BUCKETS[5]
}

const hourKey = (trade: ReportTrade) =>
  String(Math.floor(hourOfDay(trade.openedAt))).padStart(2, "0")

/** One row per day, week, month, opening hour, duration bucket or instrument. */
export function buildBreakdown(view: View, trades: ReportTrade[]): GroupRow[] {
  switch (view) {
    case "day":
      return groupBy(
        trades,
        (trade) => dayKey(trade.closedAt),
        (key) => key
      )
    case "week":
      return groupBy(
        trades,
        (trade) => weekStart(dayKey(trade.closedAt)),
        (key) => key
      )
    case "month":
      return groupBy(
        trades,
        (trade) => dayKey(trade.closedAt).slice(0, 7),
        (key) => key
      )
    case "time":
      return groupBy(trades, hourKey, (key) => `${key}:00`)
    case "duration":
      return groupBy(
        trades,
        (trade) => durationBucket(holdTime(trade)).key,
        (key) => DURATION_BUCKETS.find((bucket) => bucket.key === key)?.label ?? key
      )
    case "instrument":
      return groupBy(
        trades,
        (trade) => trade.product,
        (key) => key
      )
  }
}
