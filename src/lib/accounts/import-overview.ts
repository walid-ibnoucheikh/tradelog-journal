import { groupAccountsByFirm } from "./groups"
import { importState } from "./import-freshness"

export type AccountStatus = "active" | "blown" | "closed"

export interface ImportAccount {
  id: string
  name: string
  firm: string
  type: "eval" | "funded"
  status: AccountStatus
  lastImportedAt: Date | null
  lastTradeAt: Date | null
  endedAt: string | null
  /** When the cloud sync first did not find the account in Tradovate; null while it does. */
  notFoundAt: Date | null
}

/** "never": no import yet; "stale": behind; "fresh": up to date; "ended": blown or closed, no longer followed. */
export type ImportRowState = "never" | "stale" | "fresh" | "ended"

export interface ImportRow extends ImportAccount {
  state: ImportRowState
}

/** Needs an import: an active account never imported or behind. */
/** How long after the end of an account a last export is still worth trying. */
export const FINAL_SYNC_DAYS = 30

/** A finished account ended recently enough that Tradovate may still list it: offer a final sync. */
export function canFinalSync(row: ImportRow, now: Date): boolean {
  if (row.state !== "ended" || !row.endedAt) return false
  const ended = new Date(`${row.endedAt}T12:00:00Z`).getTime()
  return now.getTime() - ended <= FINAL_SYNC_DAYS * 86_400_000
}

export const needsAttention = (row: ImportRow) => row.state === "never" || row.state === "stale"

export function importRows(accounts: ImportAccount[], now: Date): ImportRow[] {
  return accounts.map((account) => ({
    ...account,
    state: account.status !== "active" ? "ended" : importState(account.lastImportedAt, now).state,
  }))
}

export interface ImportCounts {
  active: number
  fresh: number
  stale: number
  never: number
  ended: number
}

export function countRows(rows: ImportRow[]): ImportCounts {
  const counts: ImportCounts = { active: 0, fresh: 0, stale: 0, never: 0, ended: 0 }
  for (const row of rows) {
    if (row.state === "ended") counts.ended += 1
    else {
      counts.active += 1
      counts[row.state] += 1
    }
  }
  return counts
}

export type ScopeFilter = "active" | "ended" | "all"

export interface RowFilter {
  query: string
  /** Lower-cased firm name, or "all". */
  firm: string
  scope: ScopeFilter
  attentionOnly: boolean
}

export const firmKey = (firm: string) => firm.trim().toLowerCase()

export function filterRows(rows: ImportRow[], filter: RowFilter): ImportRow[] {
  const query = filter.query.trim().toLowerCase()
  return rows.filter(
    (row) =>
      (filter.scope === "all" || (filter.scope === "ended") === (row.state === "ended")) &&
      (filter.firm === "all" || firmKey(row.firm) === filter.firm) &&
      (!filter.attentionOnly || needsAttention(row)) &&
      (!query || `${row.name} ${row.firm}`.toLowerCase().includes(query))
  )
}

const rank: Record<ImportRowState, number> = { never: 0, stale: 1, fresh: 2, ended: 3 }

export interface ImportGroup {
  firm: string
  rows: ImportRow[]
  counts: ImportCounts
}

/**
 * Rows grouped by prop firm. What needs an import comes first, in the groups and inside each group,
 * so the work to do is always at the top however many accounts there are.
 */
export function groupImportRows(rows: ImportRow[]): ImportGroup[] {
  return groupAccountsByFirm(rows)
    .map(({ firm, accounts }) => ({
      firm,
      rows: [...accounts].sort(
        (a, b) => rank[a.state] - rank[b.state] || a.name.localeCompare(b.name)
      ),
      counts: countRows(accounts),
    }))
    .sort(
      (a, b) =>
        b.counts.stale + b.counts.never - (a.counts.stale + a.counts.never) ||
        a.firm.localeCompare(b.firm)
    )
}

/**
 * With many accounts the page would run for screens: the groups start folded, each header still
 * saying how many accounts need an import and offering its own Sync button.
 */
export const COLLAPSE_FROM = 24
export function startsOpen(total: number): boolean {
  return total < COLLAPSE_FROM
}
