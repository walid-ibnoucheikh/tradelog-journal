import { dayKey } from "./trading/stats"

export const RANGES = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "month", label: "This month" },
  { value: "lastMonth", label: "Last month" },
  { value: "year", label: "This year" },
] as const

export type RangeValue = (typeof RANGES)[number]["value"]

/** Groups of accounts the account filter offers besides a single account. */
export const ACCOUNT_SCOPES = [
  { value: "active", label: "Active accounts" },
  { value: "all", label: "All accounts" },
  { value: "funded", label: "Funded accounts only" },
  { value: "eval", label: "Evaluation accounts only" },
] as const

export type AccountScope = (typeof ACCOUNT_SCOPES)[number]["value"]

/**
 * What a page shows without an `account` parameter. The Dashboard is about the accounts in play: the active
 * ones. The pages that hold the history (Trades, Journal, Reports) show every account, blown and closed ones
 * included, so no trade is hidden and the statistics stay honest.
 */
export function defaultScopeFor(pathname: string): AccountScope {
  return pathname === "/" ? "active" : "all"
}

export interface Filters {
  /** Account ID, or null when the filter is a group of accounts (see `scope`). */
  accountId: string | null
  /** Without an account ID: the page's default group (see `defaultScopeFor`), every account, or one group. */
  scope: AccountScope
  range: RangeValue
}

/**
 * The `account` parameter for these filters on a page whose default is `defaultScope`: nothing for that
 * default, else the group name or the account id. For a link to another page, give that page's default.
 */
export function accountParam(
  filters: Pick<Filters, "accountId" | "scope">,
  defaultScope: AccountScope = "all"
): string | null {
  return filters.accountId ?? (filters.scope === defaultScope ? null : filters.scope)
}

/** The accounts of a group: all of them, the active ones, or the funded / evaluation ones (any state). */
export function accountsInScope<T extends { status: string; type: string }>(
  accounts: T[],
  scope: AccountScope
): T[] {
  switch (scope) {
    case "active":
      return accounts.filter((account) => account.status === "active")
    case "funded":
      return accounts.filter((account) => account.type === "funded")
    case "eval":
      return accounts.filter((account) => account.type === "eval")
    default:
      return accounts
  }
}

type SearchParams = Record<string, string | string[] | undefined>

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export function parseFilters(params: SearchParams, defaultScope: AccountScope = "all"): Filters {
  const range = first(params.range)
  const account = first(params.account)
  const scope = ACCOUNT_SCOPES.find((option) => option.value === account)?.value
  return {
    accountId: account && !scope ? account : null,
    scope: scope ?? defaultScope,
    range: RANGES.some((option) => option.value === range) ? (range as RangeValue) : "all",
  }
}

export function shiftDay(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

/** Inclusive YYYY-MM-DD bounds of a range in the trading timezone; null means unbounded. */
export function rangeBounds(
  range: RangeValue,
  now = new Date()
): { from: string | null; to: string | null } {
  const today = dayKey(now)
  const [year, month] = today.split("-").map(Number)
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`
  switch (range) {
    case "all":
      return { from: null, to: null }
    case "today":
      return { from: today, to: today }
    case "7d":
      return { from: shiftDay(today, -6), to: today }
    case "30d":
      return { from: shiftDay(today, -29), to: today }
    case "month":
      return { from: monthStart, to: today }
    case "lastMonth": {
      const lastDay = shiftDay(monthStart, -1)
      return { from: `${lastDay.slice(0, 7)}-01`, to: lastDay }
    }
    case "year":
      return { from: `${year}-01-01`, to: today }
  }
}
