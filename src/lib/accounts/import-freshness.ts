import { shiftDay } from "../filters"
import { calendarDay } from "../trading/stats"

/** The weekday before `date` (YYYY-MM-DD), skipping Saturday and Sunday. */
export function previousWeekday(date: string): string {
  let day = shiftDay(date, -1)
  while ([0, 6].includes(new Date(`${day}T12:00:00Z`).getUTCDay())) day = shiftDay(day, -1)
  return day
}

export type ImportState =
  | { state: "never" }
  | { state: "fresh" }
  /** The last import is older than the last weekday, which is probably missing. */
  | { state: "stale"; missedDay: string }

/**
 * Whether an account's data can be trusted to be up to date. An import made at any time on the last
 * weekday counts: the rule only flags days that were certainly traded without an import since.
 * It cannot see trades taken after an import on the same day, nor holidays (a false alarm).
 * It works on calendar days: an import on Monday evening holds nothing of Tuesday's session.
 */
export function importState(lastImportedAt: Date | null, now = new Date()): ImportState {
  if (!lastImportedAt) return { state: "never" }
  const expected = previousWeekday(calendarDay(now))
  return calendarDay(lastImportedAt) < expected
    ? { state: "stale", missedDay: expected }
    : { state: "fresh" }
}

export interface ImportSummary {
  /** The oldest last-import among the accounts that have one: the date the figures are only sure up to. */
  oldest: Date | null
  /** Accounts that look behind on imports (see `importState`). Accounts never imported are not late. */
  late: { name: string; lastImportedAt: Date }[]
}

/** One line of truth for a set of accounts: when the data stops being trustworthy, and who is late. */
export function summarizeImports(
  accounts: { name: string; lastImportedAt: Date | null }[],
  now = new Date()
): ImportSummary {
  const imported = accounts.flatMap((account) =>
    account.lastImportedAt ? [{ name: account.name, lastImportedAt: account.lastImportedAt }] : []
  )
  const oldest = imported.reduce<Date | null>(
    (min, account) => (min === null || account.lastImportedAt < min ? account.lastImportedAt : min),
    null
  )
  const late = imported
    .filter((account) => importState(account.lastImportedAt, now).state === "stale")
    .sort((a, b) => a.lastImportedAt.getTime() - b.lastImportedAt.getTime())
  return { oldest, late }
}

/** "just now", "12 min ago", "3 h ago", "2 d ago". */
export function formatAgo(date: Date, now = new Date()): string {
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60_000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes} min ago`
  if (minutes < 1440) return `${Math.floor(minutes / 60)} h ago`
  return `${Math.floor(minutes / 1440)} d ago`
}
