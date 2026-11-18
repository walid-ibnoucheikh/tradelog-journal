/** Parses a `?month=YYYY-MM` value; null when absent or malformed. */
export function parseMonth(value: string | string[] | undefined) {
  const match = typeof value === "string" ? /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value) : null
  return match ? { year: Number(match[1]), month: Number(match[2]) } : null
}

/** Stands for the month in a page address that a client month picker fills in. */
export const MONTH_PLACEHOLDER = "YYYY-MM"
/** Same for a day, in a page address built by the server and filled in by a client component. */
export const DAY_PLACEHOLDER = "YYYY-MM-DD"

/** "YYYY-MM" for a month number from 1 to 12. */
export function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`
}

/** The month `delta` months away, as "YYYY-MM". */
export function shiftMonth(year: number, month: number, delta: number): string {
  const date = new Date(Date.UTC(year, month - 1 + delta, 1))
  return monthKey(date.getUTCFullYear(), date.getUTCMonth() + 1)
}
