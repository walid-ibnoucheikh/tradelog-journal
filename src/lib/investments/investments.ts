export const TRANSACTION_TYPES = [
  { value: "evaluation", label: "Evaluation purchase" },
  { value: "reset", label: "Reset" },
  { value: "activation", label: "Activation (funded account)" },
  { value: "subscription", label: "Subscription" },
  { value: "other_fee", label: "Other fees" },
  { value: "payout", label: "Payout received" },
  { value: "education", label: "Education / mentor" },
  { value: "tools", label: "Tools (TradingView, copier…)" },
] as const

export type TransactionType = (typeof TRANSACTION_TYPES)[number]["value"]

export const ACCOUNT_STATUSES = [
  { value: "active", label: "Active" },
  { value: "blown", label: "Blown" },
  { value: "closed", label: "Closed" },
] as const

export type AccountStatus = (typeof ACCOUNT_STATUSES)[number]["value"]

export function parseTransactionType(value: unknown): TransactionType | null {
  return TRANSACTION_TYPES.find((type) => type.value === value)?.value ?? null
}

export function parseAccountStatus(value: unknown): AccountStatus | null {
  return ACCOUNT_STATUSES.find((status) => status.value === value)?.value ?? null
}

/** Spending that has nothing to do with a prop firm: courses, mentoring, tools and subscriptions. */
export function isOutsidePropFirm(type: TransactionType): boolean {
  return type === "education" || type === "tools"
}

/** Provider written on such a transaction when none is given. */
export const DEFAULT_PROVIDER: Record<"education" | "tools", string> = {
  education: "Education",
  tools: "Tools",
}

export function isIncome(type: TransactionType): boolean {
  return type === "payout"
}

/** Effect on Walid's cash: positive for a payout received, negative for any cost. */
export function signedAmount(transaction: { type: TransactionType; amount: number }): number {
  return isIncome(transaction.type) ? transaction.amount : -transaction.amount
}

/** Suggested when no provider has been entered yet. */
export const STARTER_PROVIDERS = ["TradingView", "Tradecopia"]

/**
 * Providers already used for spending outside prop firms, most used first, to suggest them again.
 * "tradingview" and "TradingView" count as one (the first spelling is kept). The labels given to
 * an empty provider ("Education", "Tools") are not suggested.
 */
export function providerSuggestions(transactions: { type: TransactionType; firm: string }[]) {
  const defaults = new Set(Object.values(DEFAULT_PROVIDER).map((label) => label.toLowerCase()))
  const used = new Map<string, { name: string; count: number }>()
  for (const transaction of transactions) {
    const name = transaction.firm.trim()
    const key = name.toLowerCase()
    if (!isOutsidePropFirm(transaction.type) || !name || defaults.has(key)) continue
    const entry = used.get(key) ?? { name, count: 0 }
    entry.count += 1
    used.set(key, entry)
  }
  if (used.size === 0) return STARTER_PROVIDERS
  return [...used.values()]
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .map((entry) => entry.name)
}
