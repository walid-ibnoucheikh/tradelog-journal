import { computeStats } from "./trading/stats"
import type { TradeStatus } from "./trading/trade"

export interface JournalTrade {
  closedAt: Date
  netPnl: number
  grossPnl: number
  commission: number
  quantity: number
  status?: TradeStatus
}

export interface DaySummary {
  /** YYYY-MM-DD in the trading timezone. */
  date: string
  trades: number
  wins: number
  losses: number
  /** Winners / (winners + losers), as a percentage; null when every trade broke even. */
  winRate: number | null
  netPnl: number
  grossPnl: number
  commissions: number
  /** Contracts traded (entries only, so a round trip of 2 contracts counts 2). */
  volume: number
  /** Null when there is no loss. */
  profitFactor: number | null
  /** Cumulative net P&L after each trade, starting from 0 before the first one. */
  curve: number[]
}

const round2 = (value: number) => Math.round(value * 100) / 100

/** Everything a Daily Journal card shows for one trading day. */
export function summarizeDay(date: string, trades: JournalTrade[]): DaySummary {
  const ordered = [...trades].sort((a, b) => a.closedAt.getTime() - b.closedAt.getTime())
  const stats = computeStats(ordered.map((trade) => ({ ...trade, openedAt: trade.closedAt })))

  const curve = [0]
  for (const trade of ordered) curve.push(round2(curve[curve.length - 1] + trade.netPnl))

  return {
    date,
    trades: ordered.length,
    wins: stats.wins,
    losses: stats.losses,
    winRate: stats.winRate,
    netPnl: stats.netPnl,
    grossPnl: round2(ordered.reduce((sum, trade) => sum + trade.grossPnl, 0)),
    commissions: round2(ordered.reduce((sum, trade) => sum + trade.commission, 0)),
    volume: ordered.reduce((sum, trade) => sum + trade.quantity, 0),
    profitFactor: stats.profitFactor,
    curve,
  }
}
