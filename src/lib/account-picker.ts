/** What the account picker needs to know about an account. */
export interface PickerAccount {
  id: string
  name: string
  firm: string
  status: "active" | "blown" | "closed"
  type: "eval" | "funded"
  initialBalance: number
}

const STATUS_LABEL = { active: "Active", blown: "Blown", closed: "Closed" } as const

/** "50K", for a 50,000 account. */
export const sizeLabel = (account: PickerAccount) => `${Math.round(account.initialBalance / 1000)}K`

/** "Apex · 50K · Eval", with the state added for an account that is no longer active. */
export function accountDetails(account: PickerAccount): string {
  return [
    account.firm,
    sizeLabel(account),
    account.type === "funded" ? "Funded" : "Eval",
    ...(account.status === "active" ? [] : [STATUS_LABEL[account.status]]),
  ].join(" · ")
}

/** Accounts whose name, firm, size, type or state contains every word of the query (case and accents ignored). */
export function matchAccounts(accounts: PickerAccount[], query: string): PickerAccount[] {
  const fold = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  const words = fold(query).split(/\s+/).filter(Boolean)
  if (words.length === 0) return accounts
  return accounts.filter((account) => {
    const haystack = fold(`${account.name} ${accountDetails(account)}`)
    return words.every((word) => haystack.includes(word))
  })
}

/** The accounts still active and the others (blown or closed), each sorted by name. */
export function splitByState(accounts: PickerAccount[]) {
  const byName = (a: PickerAccount, b: PickerAccount) => a.name.localeCompare(b.name, "en")
  return {
    active: accounts.filter((account) => account.status === "active").sort(byName),
    ended: accounts.filter((account) => account.status !== "active").sort(byName),
  }
}
