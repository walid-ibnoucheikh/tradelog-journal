import { parseMonth, shiftMonth } from "../month"
import { dayKey } from "../trading/stats"

/** "all", "12m" (the last 12 months) or a year such as "2026". */
export type Period = string

export interface PeriodRange {
  /** Inclusive YYYY-MM-DD bounds. */
  from: string
  to: string
}

export function parsePeriod(value: string | string[] | undefined): Period {
  const period = Array.isArray(value) ? value[0] : value
  return period === "12m" || (period !== undefined && /^\d{4}$/.test(period)) ? period : "all"
}

/**
 * The days a period covers, or null for everything. "12m" starts on the first day of the month
 * eleven months back, so it lines up with twelve bars of the monthly chart.
 */
export function periodRange(period: Period, today: string): PeriodRange | null {
  if (period === "all") return null
  if (period === "12m") {
    const current = parseMonth(today.slice(0, 7))!
    return { from: `${shiftMonth(current.year, current.month, -11)}-01`, to: today }
  }
  return { from: `${period}-01-01`, to: `${period}-12-31` }
}

export function inRange(day: string, range: PeriodRange | null): boolean {
  return range === null || (day >= range.from && day <= range.to)
}

/** Years to offer, newest first: every year with a transaction, plus the current one. */
export function periodYears(days: string[], today: string): string[] {
  return [...new Set([...days.map((day) => day.slice(0, 4)), today.slice(0, 4)])].sort().reverse()
}

export function periodLabel(period: Period): string {
  if (period === "all") return "All time"
  if (period === "12m") return "Last 12 months"
  return period
}

/** Net P&L of each account's trades closed during the period (by trading day). */
export function tradingPnlInPeriod(
  results: Map<string, { closedAt: Date; netPnl: number }[]>,
  range: PeriodRange | null
): Map<string, number> {
  const pnl = new Map<string, number>()
  for (const [accountId, trades] of results) {
    const sum = trades
      .filter((trade) => inRange(dayKey(trade.closedAt), range))
      .reduce((total, trade) => total + trade.netPnl, 0)
    pnl.set(accountId, Math.round(sum * 100) / 100)
  }
  return pnl
}
