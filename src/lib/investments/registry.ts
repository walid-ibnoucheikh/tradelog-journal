import { signedAmount, type TransactionType } from "./investments"

export interface RegistryFilters {
  /** Lower-cased firm, or null for every firm. */
  firm: string | null
  accountId: string | null
  /** Four-digit year, or null for every year. */
  year: string | null
  page: number
}

interface RegistryRow {
  day: string
  firm: string
  accountId: string | null
  type: TransactionType
  amount: number
}

type SearchParams = Record<string, string | string[] | undefined>

const first = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value) || null

export const firmKey = (firm: string) => firm.trim().toLowerCase()

export function parseRegistryFilters(params: SearchParams): RegistryFilters {
  const year = first(params.year)
  const firm = first(params.firm)
  const page = Number(first(params.page))
  return {
    firm: firm && firm !== "all" ? firmKey(firm) : null,
    accountId: first(params.account) !== "all" ? first(params.account) : null,
    year: year && /^\d{4}$/.test(year) ? year : null,
    page: Number.isInteger(page) && page > 0 ? page : 1,
  }
}

export function filterTransactions<T extends RegistryRow>(rows: T[], filters: RegistryFilters) {
  return rows.filter(
    (row) =>
      (!filters.firm || firmKey(row.firm) === filters.firm) &&
      (!filters.accountId || row.accountId === filters.accountId) &&
      (!filters.year || row.day.startsWith(`${filters.year}-`))
  )
}

/** Choices for the filters: every firm (first spelling kept) and every year with a transaction. */
export function registryOptions(rows: { day: string; firm: string }[]) {
  const firms = new Map<string, string>()
  const years = new Set<string>()
  for (const row of rows) {
    if (!firms.has(firmKey(row.firm))) firms.set(firmKey(row.firm), row.firm.trim())
    years.add(row.day.slice(0, 4))
  }
  return {
    firms: [...firms.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    years: [...years].sort().reverse(),
  }
}

/** Effect on Walid's cash of these rows: payouts minus costs. */
export function registryNet(rows: RegistryRow[]) {
  return Math.round(rows.reduce((sum, row) => sum + signedAmount(row), 0) * 100) / 100
}
