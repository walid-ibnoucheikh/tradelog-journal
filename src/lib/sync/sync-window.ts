import { shiftDay } from "../filters"
import { calendarDay, dayKey } from "../trading/stats"

/** Days re-read before the last data we hold, so a late fill or a fee posted afterwards is caught. */
export const OVERLAP_DAYS = 7
/** How far back the very first sync of an account goes. */
export const FIRST_SYNC_DAYS = 30

export interface SyncWindow {
  /** First day to export, YYYY-MM-DD. */
  from: string
  /** Last day to export (the current trading day), YYYY-MM-DD. */
  to: string
}

/**
 * The period an account's export has to cover. It starts a week before the older of the last import
 * and the last fill we hold: the import time alone could hide a gap (a short file imported late),
 * and the last fill alone would ignore a recent import with nothing new. Re-reading days we already
 * have is harmless, the import is idempotent.
 */
export function syncWindow(
  account: { lastImportedAt: Date | null; lastFillAt: Date | null },
  now = new Date()
): SyncWindow {
  // Tradovate filters on the trading day: after 18:00 ET a fill already belongs to tomorrow's date.
  const to = dayKey(now)
  const known = [account.lastImportedAt, account.lastFillAt]
    .filter((date): date is Date => date !== null)
    .map(calendarDay)
  if (known.length === 0) return { from: shiftDay(to, -FIRST_SYNC_DAYS), to }
  const base = known.reduce((oldest, day) => (day < oldest ? day : oldest))
  return { from: shiftDay(base, -OVERLAP_DAYS), to }
}
