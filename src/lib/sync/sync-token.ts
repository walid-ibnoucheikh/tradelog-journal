/**
 * Access for the cloud sync run. It is not a person, so it has no session cookie: it proves itself
 * with a long shared token (`SYNC_TOKEN`) in the `Authorization` header. Free of any Next.js import
 * so the proxy, the routes and the tests can all use it.
 */

export const SYNC_ROUTE_PREFIX = "/api/sync"
export const MIN_SYNC_TOKEN_LENGTH = 32

export type SyncAuth = "ok" | "disabled" | "unauthorized"

/** Whether a path belongs to the sync run's routes, which the proxy lets through to check the token itself. */
export function isSyncRoute(pathname: string): boolean {
  return pathname === SYNC_ROUTE_PREFIX || pathname.startsWith(`${SYNC_ROUTE_PREFIX}/`)
}

const encoder = new TextEncoder()

async function digest(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)))
}

/**
 * "disabled" when no usable token is configured (the sync feature is simply off), "unauthorized"
 * for a missing or wrong one. The comparison runs over fixed-length digests and does not stop at the
 * first difference, so its timing reveals nothing about the token.
 */
export async function checkSyncToken(
  configured: string | undefined,
  authorization: string | null
): Promise<SyncAuth> {
  if (!configured || configured.length < MIN_SYNC_TOKEN_LENGTH) return "disabled"
  const match = /^Bearer (\S+)$/.exec(authorization ?? "")
  if (!match) return "unauthorized"
  const [expected, given] = await Promise.all([digest(configured), digest(match[1])])
  let difference = 0
  for (let index = 0; index < expected.length; index++) difference |= expected[index] ^ given[index]
  return difference === 0 ? "ok" : "unauthorized"
}
