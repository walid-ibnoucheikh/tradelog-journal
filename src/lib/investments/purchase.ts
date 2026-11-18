import { isRealDay } from "@/lib/day"

/** What an account can have been bought as: the evaluation, its activation, a reset, other fees. */
export const PURCHASE_TYPES = ["evaluation", "activation", "reset", "other_fee"] as const
export type PurchaseType = (typeof PURCHASE_TYPES)[number]

export interface Purchase {
  amount: number
  day: string
  type: PurchaseType
}

export const MAX_AMOUNT = 1_000_000

/**
 * The optional purchase of the "Add account" form. An empty amount means "not now" (null); anything
 * else must be a valid amount, day and type, so a typo is reported instead of silently dropped.
 */
export function readPurchase(input: {
  amount: string
  day: string
  type: string
}): { error: string } | { purchase: Purchase | null } {
  if (input.amount.trim() === "") return { purchase: null }
  const amount = Number(input.amount)
  if (!(amount > 0) || amount > MAX_AMOUNT) {
    return { error: "The purchase cost must be a positive number (in USD), or left empty." }
  }
  if (!isRealDay(input.day)) return { error: "Invalid purchase date." }
  const type = PURCHASE_TYPES.find((value) => value === input.type)
  if (!type) return { error: "Invalid purchase type." }
  return { purchase: { amount: Math.round(amount * 100) / 100, day: input.day, type } }
}

/** What can be recorded on an account afterwards: the same costs, subscriptions and payouts. */
export const ACCOUNT_PAYMENT_TYPES = [
  "evaluation",
  "reset",
  "activation",
  "subscription",
  "other_fee",
  "payout",
] as const
