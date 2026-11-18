/** Walid's own timezone, used for defaults like "today" on forms about money (not trading days). */
export const USER_TIMEZONE = "Europe/Paris"

/** Today's date as YYYY-MM-DD in the given timezone. */
export function today(timeZone: string, now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now)
}

/** True for a real calendar day written YYYY-MM-DD (rejects 2026-02-30 and malformed text). */
export function isRealDay(day: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false
  const parsed = new Date(`${day}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === day
}
