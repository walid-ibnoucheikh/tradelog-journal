import { getInstrument } from "./instruments"

export type TradeStatus = "win" | "loss" | "be"

export const STATUSES = [
  { value: "all", label: "All statuses" },
  { value: "win", label: "Win" },
  { value: "loss", label: "Loss" },
  { value: "be", label: "Break-even" },
] as const

export type StatusFilter = (typeof STATUSES)[number]["value"]

/**
 * A trade exited within this range of points per contract, measured in its own direction
 * (negative = against it), counts as break-even unless Walid says otherwise. The upper bound is
 * one tick above the +2 points where he moves his stop to cover commissions, to allow for slippage.
 */
export const BREAKEVEN_MIN_POINTS = -0.25
export const BREAKEVEN_MAX_POINTS = 2.25

export interface StatusInput {
  product: string
  quantity: number
  grossPnl: number
  netPnl: number
  /** true = forced break-even, false = forced not break-even, null = decided by the rule. */
  breakEvenOverride: boolean | null
}

export type BreakEvenSource = "manual" | "auto"

/** Average gross points gained per contract, positive when the trade went its way. */
export function pointsPerContract(trade: {
  product: string
  quantity: number
  grossPnl: number
}): number {
  const { pointValue } = getInstrument(trade.product)
  return Math.round((trade.grossPnl / (pointValue * trade.quantity)) * 10_000) / 10_000
}

/** Status of a trade, and whether a break-even comes from the rule ("auto") or a manual choice. */
export function describeTrade(trade: StatusInput): {
  status: TradeStatus
  breakEvenSource: BreakEvenSource | null
} {
  if (trade.breakEvenOverride === true) return { status: "be", breakEvenSource: "manual" }
  if (trade.breakEvenOverride === null) {
    const points = pointsPerContract(trade)
    if (points >= BREAKEVEN_MIN_POINTS && points <= BREAKEVEN_MAX_POINTS) {
      return { status: "be", breakEvenSource: "auto" }
    }
  }
  const status = trade.netPnl > 0 ? "win" : trade.netPnl < 0 ? "loss" : "be"
  return { status, breakEvenSource: null }
}

export function parseStatus(value: string | string[] | undefined): StatusFilter {
  const status = Array.isArray(value) ? value[0] : value
  return STATUSES.some((option) => option.value === status) ? (status as StatusFilter) : "all"
}

export function matchesStatus(status: TradeStatus, filter: StatusFilter): boolean {
  return filter === "all" || status === filter
}

/** Points gained (positive) or lost (negative), whatever the direction of the trade. */
export function tradePoints(trade: {
  direction: string
  avgEntry: number
  avgExit: number
}): number {
  const move = trade.avgExit - trade.avgEntry
  return Math.round((trade.direction === "Long" ? move : -move) * 100) / 100
}

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
