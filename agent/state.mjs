/**
 * The browser state (cookies and local storage) of a Tradovate profile, packed as one line of text so
 * it fits in a GitHub secret: JSON, gzip, base64. A cloud browser that loads it is recognised by
 * Tradovate like the browser it was taken from, and skips the first-visit screens.
 */
import { gunzipSync, gzipSync } from "node:zlib"

/** GitHub refuses a secret above 48 KB. */
export const SECRET_LIMIT_BYTES = 48 * 1024

/** Any JSON value as one line of text (gzip, base64). */
export function packJson(value) {
  return gzipSync(Buffer.from(JSON.stringify(value), "utf8"), { level: 9 }).toString("base64")
}

export function unpackJson(text) {
  return JSON.parse(gunzipSync(Buffer.from(text.trim(), "base64")).toString("utf8"))
}

export const encodeState = packJson

export function decodeState(text) {
  const state = unpackJson(text)
  if (!Array.isArray(state?.cookies) || !Array.isArray(state?.origins)) {
    throw new Error("This is not a browser state (cookies and origins are missing).")
  }
  return state
}

/** Counts only, for logs: what a state holds, never its content. */
export function describeState(state) {
  return {
    cookies: state.cookies.length,
    origins: state.origins.length,
    storageItems: state.origins.reduce((sum, origin) => sum + origin.localStorage.length, 0),
  }
}

/** Where a cookie's remaining life falls, in days. */
const BUCKETS = [
  { label: "under 1 day", max: 1 },
  { label: "1 to 7 days", max: 7 },
  { label: "7 to 30 days", max: 30 },
  { label: "30 to 90 days", max: 90 },
  { label: "over 90 days", max: Infinity },
]

/**
 * When the cookies of a state stop being valid (their own expiry dates, set by Tradovate): how many
 * end with the browser, how the others spread over time, and the names of those under 30 days.
 * Dates, counts and names only, never a value. It says nothing of what Tradovate decides on its
 * side, or of local storage.
 */
export function describeExpiry(state, now = new Date()) {
  const persistent = state.cookies.filter((cookie) => cookie.expires > 0)
  const daysLeft = (cookie) => (cookie.expires * 1000 - now.getTime()) / 86_400_000
  const spread = BUCKETS.map(({ label }) => ({ label, count: 0, names: [] }))
  for (const cookie of persistent) {
    const days = daysLeft(cookie)
    const index = BUCKETS.findIndex(({ max }) => days < max)
    spread[index].count += 1
    spread[index].names.push(cookie.name)
  }
  return {
    sessionOnly: state.cookies.length - persistent.length,
    persistent: persistent.length,
    spread,
  }
}

/** The lines to print about it. */
export function expiryLines(state, now = new Date()) {
  const { sessionOnly, persistent, spread } = describeExpiry(state, now)
  const lines = [
    `Cookies: ${persistent} with an expiry date, ${sessionOnly} that end with the browser.`,
  ]
  for (const { label, count, names } of spread) {
    if (count === 0) continue
    // Names only for the short-lived ones: they are what would force a new export.
    const short = ["under 1 day", "1 to 7 days", "7 to 30 days"].includes(label)
    lines.push(`  ${label}: ${count}${short ? ` (${[...new Set(names)].join(", ")})` : ""}`)
  }
  return lines
}
