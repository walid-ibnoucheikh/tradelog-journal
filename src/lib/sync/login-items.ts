import { accountLoginKey, firmKey } from "./firm-key"

export interface LoginItem {
  key: string
  firm: string
  /** Name of an additional login; null for the default login of the firm. */
  label: string | null
  saved: boolean
  /** Names of the active accounts that use it. */
  accounts: string[]
}

interface AccountLike {
  name: string
  firm: string
  status: string
  loginKey?: string | null
}

interface SavedLike {
  key: string
  firm: string
  label: string | null
}

/**
 * The Tradovate logins to show: the ones the active accounts need (saved or not) and the ones saved
 * without an active account. The default logins first, each group in firm order.
 */
export function loginItems(accounts: AccountLike[], saved: SavedLike[]): LoginItem[] {
  const items = new Map<string, LoginItem>()
  const savedKeys = new Set(saved.map((row) => row.key))
  const savedLabels = new Map(saved.map((row) => [row.key, row.label]))
  for (const account of accounts) {
    if (account.status !== "active" || !firmKey(account.firm)) continue
    const key = accountLoginKey(account)
    const item = items.get(key) ?? {
      key,
      firm: account.firm.trim(),
      label: key.includes(":") ? (savedLabels.get(key) ?? "other login") : null,
      saved: savedKeys.has(key),
      accounts: [],
    }
    item.accounts.push(account.name)
    items.set(key, item)
  }
  for (const row of saved) {
    if (!items.has(row.key)) {
      items.set(row.key, {
        key: row.key,
        firm: row.firm,
        label: row.label,
        saved: true,
        accounts: [],
      })
    }
  }
  return [...items.values()].sort(
    (a, b) =>
      a.firm.localeCompare(b.firm) ||
      Number(a.label !== null) - Number(b.label !== null) ||
      (a.label ?? "").localeCompare(b.label ?? "")
  )
}

/** "Apex" or "Apex · apex-2". */
export const loginTitle = (item: Pick<LoginItem, "firm" | "label">) =>
  item.label ? `${item.firm} · ${item.label}` : item.firm
