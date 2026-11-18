import { dayKey } from "../trading/stats"

export type DrawdownType = "eod_trailing" | "intraday_trailing"

export const DRAWDOWN_TYPES = [
  { value: "eod_trailing", label: "End of day (EOD)" },
  { value: "intraday_trailing", label: "Intraday" },
] as const

export function parseDrawdownType(value: unknown): DrawdownType | null {
  return DRAWDOWN_TYPES.find((type) => type.value === value)?.value ?? null
}

/** The rules of one prop firm account, as entered when it was created. A null means "no such rule". */
export interface AccountRules {
  initialBalance: number
  profitTarget: number | null
  maxDrawdown: number | null
  drawdownType: DrawdownType
  /** The drawdown threshold never rises above this balance. */
  drawdownLockLevel: number | null
  dailyLossLimit: number | null
  /** The best day may not exceed this share (%) of the total profit; null for no rule. */
  consistencyPercent: number | null
}

export interface AccountProgress {
  /** Initial balance plus the net P&L of every trade. */
  balance: number
  /** Balance minus the initial balance. */
  profit: number
  target: {
    amount: number
    remaining: number
    /** Share of the target reached, from 0 to 100. */
    percent: number
    reached: boolean
  } | null
  drawdown: {
    type: DrawdownType
    maxDrawdown: number
    /** Liquidation threshold: the balance at which the account is lost. It trails the balance peak. */
    threshold: number
    /** Balance minus the threshold; zero or negative means the threshold is hit. */
    distance: number
    /** Remaining margin as a share of the maximum drawdown, from 0 to 100. */
    percentRemaining: number
    breached: boolean
    /** True when the threshold is held back by the lock level. */
    locked: boolean
    /** EOD only: today's balance is above the peak, so the threshold will rise when the session ends. */
    risesAtSessionEnd: boolean
  } | null
  dailyLoss: {
    limit: number
    /** Loss so far in the current session, never negative. */
    lostToday: number
    remaining: number
    breached: boolean
  } | null
  consistency: {
    limitPercent: number
    /** Net P&L of the best day. */
    bestDay: number
    /** Best day as a share (%) of the total profit; null while there is no profit. */
    share: number | null
    /** False only when the best day weighs more than the limit. */
    compliant: boolean
    /** Extra profit needed, with no better day, to bring the best day back under the limit. */
    leftToEarn: number
  } | null
}

const round2 = (value: number) => Math.round(value * 100) / 100
const clampPercent = (value: number) => Math.min(100, Math.max(0, value))

/**
 * Where an account stands against its rules. The drawdown threshold trails the best balance reached:
 * - EOD: the best end-of-session balance, counting only sessions that are already over, so today's gains
 *   raise the balance but not yet the threshold;
 * - intraday: the best balance after any closed trade (on realized P&L only: open P&L is not in our data).
 * The lock level, when set, is the balance the threshold never rises above.
 */
export function computeAccountProgress(
  rules: AccountRules,
  trades: { closedAt: Date; netPnl: number }[],
  now = new Date()
): AccountProgress {
  const today = dayKey(now)
  const bySession = new Map<string, number>()
  for (const trade of trades) {
    const day = dayKey(trade.closedAt)
    bySession.set(day, (bySession.get(day) ?? 0) + trade.netPnl)
  }

  const balance = round2(
    rules.initialBalance + [...bySession.values()].reduce((sum, pnl) => sum + pnl, 0)
  )
  const profit = round2(balance - rules.initialBalance)

  let drawdown: AccountProgress["drawdown"] = null
  if (rules.maxDrawdown !== null) {
    let endOfDayPeak = rules.initialBalance
    let running = rules.initialBalance
    for (const [day, pnl] of [...bySession.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      running += pnl
      if (day < today) endOfDayPeak = Math.max(endOfDayPeak, running)
    }

    let intradayPeak = rules.initialBalance
    let tradeBalance = rules.initialBalance
    for (const trade of [...trades].sort((a, b) => a.closedAt.getTime() - b.closedAt.getTime())) {
      tradeBalance += trade.netPnl
      intradayPeak = Math.max(intradayPeak, tradeBalance)
    }

    const intraday = rules.drawdownType === "intraday_trailing"
    const peak = intraday ? intradayPeak : endOfDayPeak
    const raw = round2(peak - rules.maxDrawdown)
    const threshold =
      rules.drawdownLockLevel !== null ? Math.min(raw, rules.drawdownLockLevel) : raw
    const distance = round2(balance - threshold)
    drawdown = {
      type: rules.drawdownType,
      maxDrawdown: rules.maxDrawdown,
      threshold,
      distance,
      percentRemaining: clampPercent((distance / rules.maxDrawdown) * 100),
      breached: distance <= 0,
      locked: rules.drawdownLockLevel !== null && threshold < raw,
      risesAtSessionEnd:
        !intraday &&
        round2(balance - rules.maxDrawdown) > threshold &&
        (rules.drawdownLockLevel === null || threshold < rules.drawdownLockLevel),
    }
  }

  let dailyLoss: AccountProgress["dailyLoss"] = null
  if (rules.dailyLossLimit !== null) {
    const lostToday = round2(Math.max(0, -(bySession.get(today) ?? 0)))
    dailyLoss = {
      limit: rules.dailyLossLimit,
      lostToday,
      remaining: round2(rules.dailyLossLimit - lostToday),
      breached: lostToday >= rules.dailyLossLimit,
    }
  }

  let consistency: AccountProgress["consistency"] = null
  if (rules.consistencyPercent !== null) {
    const bestDay = round2(Math.max(0, ...bySession.values()))
    const share = profit > 0 ? (bestDay / profit) * 100 : null
    const compliant = share === null || share <= rules.consistencyPercent
    consistency = {
      limitPercent: rules.consistencyPercent,
      bestDay,
      share,
      compliant,
      leftToEarn: compliant ? 0 : round2(bestDay / (rules.consistencyPercent / 100) - profit),
    }
  }

  return {
    balance,
    profit,
    target:
      rules.profitTarget === null
        ? null
        : {
            amount: rules.profitTarget,
            remaining: round2(Math.max(0, rules.profitTarget - profit)),
            percent: clampPercent((profit / rules.profitTarget) * 100),
            reached: profit >= rules.profitTarget,
          },
    drawdown,
    dailyLoss,
    consistency,
  }
}

export interface Breach {
  /** Trading day (YYYY-MM-DD) of the trade that took the balance down to the threshold. */
  day: string
  balance: number
  threshold: number
}

/**
 * The first trade after which the balance is at or below the liquidation threshold, or null. The
 * threshold is rebuilt as it stood at that trade (EOD: the best end of a session already over;
 * intraday: the best balance after any earlier trade), with the lock level applied. Realized P&L
 * only, like `computeAccountProgress`.
 */
export function findBreach(
  rules: AccountRules,
  trades: { closedAt: Date; netPnl: number }[]
): Breach | null {
  if (rules.maxDrawdown === null) return null
  const intraday = rules.drawdownType === "intraday_trailing"
  let balance = rules.initialBalance
  let intradayPeak = balance
  let endOfDayPeak = balance
  let session: string | null = null

  for (const trade of [...trades].sort((a, b) => a.closedAt.getTime() - b.closedAt.getTime())) {
    const day = dayKey(trade.closedAt)
    // Moving on to a new session: the one that just ended now counts for the end-of-day peak.
    if (session !== null && day !== session) endOfDayPeak = Math.max(endOfDayPeak, balance)
    session = day
    balance = round2(balance + trade.netPnl)
    intradayPeak = Math.max(intradayPeak, balance)

    const raw = round2((intraday ? intradayPeak : endOfDayPeak) - rules.maxDrawdown)
    const threshold =
      rules.drawdownLockLevel !== null ? Math.min(raw, rules.drawdownLockLevel) : raw
    if (balance <= threshold) return { day, balance, threshold }
  }
  return null
}
