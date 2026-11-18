import { dayKey } from "../trading/stats"

export interface BalancePoint {
  /** The trading day, YYYY-MM-DD (see `dayKey`). */
  date: string
  /** Balance at the end of that session. */
  balance: number
}

const round2 = (value: number) => Math.round(value * 100) / 100

/** Balance of one account at the end of each trading session. */
export function buildBalanceSeries(
  initialBalance: number,
  trades: { closedAt: Date; netPnl: number }[]
): BalancePoint[] {
  const bySession = new Map<string, number>()
  for (const trade of trades) {
    const day = dayKey(trade.closedAt)
    bySession.set(day, (bySession.get(day) ?? 0) + trade.netPnl)
  }

  let balance = initialBalance
  return [...bySession.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, pnl]) => {
      balance += pnl
      return { date, balance: round2(balance) }
    })
}

/**
 * The balance of several accounts added together, on the days where any of them traded. An account keeps
 * its last balance on the days it did not trade, and counts for its initial balance before its first day.
 */
export function sumBalances(
  accounts: { initialBalance: number; points: BalancePoint[] }[]
): BalancePoint[] {
  const dates = [
    ...new Set(accounts.flatMap((account) => account.points.map((p) => p.date))),
  ].sort()
  const lasts = accounts.map((account) => ({
    byDate: new Map(account.points.map((point) => [point.date, point.balance])),
    last: account.initialBalance,
  }))
  return dates.map((date) => {
    let total = 0
    for (const state of lasts) {
      state.last = state.byDate.get(date) ?? state.last
      total += state.last
    }
    return { date, balance: round2(total) }
  })
}

/** Keeps the points inside an optional period (YYYY-MM-DD bounds, both included). */
export function clipToPeriod<T extends { date: string }>(
  points: T[],
  from: string | null,
  to: string | null
): T[] {
  return points.filter((point) => (!from || point.date >= from) && (!to || point.date <= to))
}
