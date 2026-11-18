/** What a cancelled request says, so the page can show it as a choice and not as a failure. */
export const CANCELLED_MESSAGE = "Cancelled."

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const isUuid = (value: string) => UUID.test(value)

export const FINISH_STATUSES = ["done", "failed", "needs_login"] as const
export type FinishStatus = (typeof FINISH_STATUSES)[number]

const MAX_IDS = 500

/** A list of account ids from an untrusted body: only uuids, capped; null when it is not a list. */
function readIds(value: unknown): string[] | null {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.length > MAX_IDS) return null
  return value.every((id) => typeof id === "string" && isUuid(id)) ? (value as string[]) : null
}

/**
 * The outcome the cloud run reports, or null when the body is not one. `found` and `missing` are the
 * accounts it did and did not find in its Tradovate login; `empty` are the ones it exported
 * successfully with nothing to import (no activity in the period).
 */
export function parseFinish(body: unknown): {
  status: FinishStatus
  message: string
  found: string[]
  missing: string[]
  empty: string[]
} | null {
  if (typeof body !== "object" || body === null) return null
  const { status, message, found, missing, empty } = body as Record<string, unknown>
  if (!FINISH_STATUSES.includes(status as FinishStatus)) return null
  if (typeof message !== "string") return null
  const foundIds = readIds(found)
  const missingIds = readIds(missing)
  const emptyIds = readIds(empty)
  if (foundIds === null || missingIds === null || emptyIds === null) return null
  return {
    status: status as FinishStatus,
    message: message.trim().slice(0, 4000),
    found: foundIds,
    missing: missingIds,
    empty: emptyIds,
  }
}
