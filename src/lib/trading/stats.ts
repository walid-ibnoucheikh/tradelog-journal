/** Timezone used to decide which trading day a trade belongs to and its hour of the day. */
export const TRADING_TIMEZONE = "America/New_York"

/** Futures sessions open at this hour (New York time) and count for the following day. */
const SESSION_START_HOUR = 18

import type { TradeStatus } from "./trade"

export interface TradeLike {
  openedAt: Date
  closedAt: Date
  netPnl: number
  /** Counts as a win, loss or break-even; when absent it follows the sign of `netPnl`. */
  status?: TradeStatus
}

export interface DayStat {
  /** The trading day, YYYY-MM-DD (see `dayKey`). */
  date: string
  netPnl: number
  trades: number
  /** Winners / (winners + losers) for the day, as a percentage; null if every trade broke even. */
  winRate: number | null
}

export interface Stats {
  tradeCount: number
  netPnl: number
  wins: number
  losses: number
  breakeven: number
  /** Winners / (winners + losers), as a percentage. Null when there is no decided trade. */
  winRate: number | null
  grossProfit: number
  grossLoss: number
  /** Null when there is no loss (undefined ratio). */
  profitFactor: number | null
  avgWin: number
  avgLoss: number
  /** Average win divided by average loss. Null when there is no loss. */
  avgWinLossRatio: number | null
  days: DayStat[]
  winningDays: number
  losingDays: number
  breakevenDays: number
  dayWinRate: number | null
  /** Cumulative net P&L at the end of each trading day. */
  cumulative: { date: string; value: number }[]
  /** Distance below the running peak of the cumulative P&L (0 or negative), starting from a peak of 0. */
  drawdown: { date: string; value: number }[]
  maxDrawdown: number
}

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TRADING_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: TRADING_TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
})

const round2 = (value: number) => Math.round(value * 100) / 100

/**
 * The calendar date in New York, midnight to midnight. Not for grouping trades (use `dayKey`):
 * it is for reasoning about weekdays, such as which imports are missing.
 */
export function calendarDay(date: Date): string {
  return dayFormatter.format(date)
}

/**
 * The trading day a moment belongs to, as YYYY-MM-DD. A futures session opens at 18:00 New York
 * time and ends at 17:00 the next day, so anything from 18:00 on counts for the following day.
 * This is the date Tradovate and the prop firms report: a trade closed at 20:37 on the 26th is a
 * trade of the 27th.
 */
export function dayKey(date: Date): string {
  const day = calendarDay(date)
  if (hourOfDay(date) < SESSION_START_HOUR) return day
  const [year, month, dayOfMonth] = day.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, dayOfMonth + 1)).toISOString().slice(0, 10)
}

/** Hour of the day in the trading timezone as a decimal, e.g. 9.5 for 09:30. */
export function hourOfDay(date: Date): number {
  const [hour, minute] = timeFormatter.format(date).split(":").map(Number)
  return hour + minute / 60
}

const percentage = (part: number, total: number) => (total === 0 ? null : (part / total) * 100)

function statusOf(trade: TradeLike): TradeStatus {
  return trade.status ?? (trade.netPnl > 0 ? "win" : trade.netPnl < 0 ? "loss" : "be")
}

export function computeStats(trades: TradeLike[]): Stats {
  const wins = trades.filter((trade) => statusOf(trade) === "win")
  const losses = trades.filter((trade) => statusOf(trade) === "loss")
  // Money is counted on every trade, break-even ones included: their commissions are real.
  const grossProfit = round2(
    trades.filter((trade) => trade.netPnl > 0).reduce((sum, trade) => sum + trade.netPnl, 0)
  )
  const grossLoss = round2(
    Math.abs(
      trades.filter((trade) => trade.netPnl < 0).reduce((sum, trade) => sum + trade.netPnl, 0)
    )
  )
  const winTotal = wins.reduce((sum, trade) => sum + trade.netPnl, 0)
  const lossTotal = Math.abs(losses.reduce((sum, trade) => sum + trade.netPnl, 0))
  const avgWin = wins.length ? winTotal / wins.length : 0
  const avgLoss = losses.length ? lossTotal / losses.length : 0

  const byDay = new Map<string, TradeLike[]>()
  for (const trade of trades) {
    const key = dayKey(trade.closedAt)
    byDay.set(key, [...(byDay.get(key) ?? []), trade])
  }
  const days: DayStat[] = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dayTrades]) => {
      const dayWins = dayTrades.filter((trade) => statusOf(trade) === "win").length
      const dayLosses = dayTrades.filter((trade) => statusOf(trade) === "loss").length
      return {
        date,
        netPnl: round2(dayTrades.reduce((sum, trade) => sum + trade.netPnl, 0)),
        trades: dayTrades.length,
        winRate: percentage(dayWins, dayWins + dayLosses),
      }
    })

  const winningDays = days.filter((day) => day.netPnl > 0).length
  const losingDays = days.filter((day) => day.netPnl < 0).length

  let running = 0
  let peak = 0
  const cumulative: Stats["cumulative"] = []
  const drawdown: Stats["drawdown"] = []
  for (const day of days) {
    running = round2(running + day.netPnl)
    peak = Math.max(peak, running)
    cumulative.push({ date: day.date, value: running })
    drawdown.push({ date: day.date, value: round2(running - peak) })
  }

  return {
    tradeCount: trades.length,
    netPnl: round2(trades.reduce((sum, trade) => sum + trade.netPnl, 0)),
    wins: wins.length,
    losses: losses.length,
    breakeven: trades.length - wins.length - losses.length,
    winRate: percentage(wins.length, wins.length + losses.length),
    grossProfit,
    grossLoss,
    profitFactor: grossLoss === 0 ? null : grossProfit / grossLoss,
    avgWin,
    avgLoss,
    avgWinLossRatio: avgLoss === 0 ? null : avgWin / avgLoss,
    days,
    winningDays,
    losingDays,
    breakevenDays: days.length - winningDays - losingDays,
    dayWinRate: percentage(winningDays, winningDays + losingDays),
    cumulative,
    drawdown,
    maxDrawdown: Math.min(0, ...drawdown.map((point) => point.value)),
  }
}

export interface CalendarDay {
  /** Day of the month. */
  day: number
  stat: DayStat | null
}

export interface CalendarWeek {
  /** Seven cells, Sunday first; null for days outside the month. */
  days: (CalendarDay | null)[]
  netPnl: number
  tradingDays: number
}

/** Weeks of a month (Sunday first) with each day's stats and a weekly total. `month` is 1-12. */
export function monthCalendar(days: DayStat[], year: number, month: number): CalendarWeek[] {
  const byDate = new Map(days.map((day) => [day.date, day]))
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()

  const weeks: CalendarWeek[] = []
  let cells: (CalendarDay | null)[] = Array(firstWeekday).fill(null)
  const flush = () => {
    while (cells.length < 7) cells.push(null)
    const stats = cells.flatMap((cell) => (cell?.stat ? [cell.stat] : []))
    weeks.push({
      days: cells,
      netPnl: round2(stats.reduce((sum, stat) => sum + stat.netPnl, 0)),
      tradingDays: stats.length,
    })
    cells = []
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    cells.push({ day, stat: byDate.get(date) ?? null })
    if (cells.length === 7) flush()
  }
  if (cells.length > 0) flush()
  return weeks
}
