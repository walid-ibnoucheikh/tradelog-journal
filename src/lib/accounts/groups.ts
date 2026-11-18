export interface FirmGroup<T> {
  /** The firm as written, e.g. "Tradeify": the spelling most accounts use; on a tie, one starting with a capital. */
  firm: string
  accounts: T[]
}

/** Groups accounts by prop firm, ignoring case, keeping the order the firms first appear in. */
export function groupAccountsByFirm<T extends { firm: string }>(accounts: T[]): FirmGroup<T>[] {
  const groups = new Map<string, { spellings: Map<string, number>; accounts: T[] }>()
  for (const account of accounts) {
    const key = account.firm.trim().toLowerCase()
    const group = groups.get(key) ?? { spellings: new Map<string, number>(), accounts: [] }
    const spelling = account.firm.trim()
    group.spellings.set(spelling, (group.spellings.get(spelling) ?? 0) + 1)
    group.accounts.push(account)
    groups.set(key, group)
  }
  return [...groups.values()].map(({ spellings, accounts: members }) => {
    let firm = ""
    let best = 0
    for (const [spelling, count] of spellings) {
      const capitalised = /^\p{Lu}/u.test(spelling) && !/^\p{Lu}/u.test(firm)
      if (count > best || (count === best && capitalised)) {
        firm = spelling
        best = count
      }
    }
    return { firm, accounts: members }
  })
}

/** Finished accounts, the most recently ended first; one without an end date goes last. */
export function sortByEndDate<T extends { endedAt: string | null }>(accounts: T[]): T[] {
  return [...accounts].sort((a, b) => (b.endedAt ?? "").localeCompare(a.endedAt ?? ""))
}
