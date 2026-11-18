import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { SESSION_COOKIE, authStatus, verifySessionToken } from "./auth-core"

/** Whether this request carries a valid session (always true when the app is open, as in local dev). */
export async function isAuthenticated(): Promise<boolean> {
  const status = authStatus(process.env)
  if (status.mode === "disabled") return true
  if (status.mode === "misconfigured") return false
  return verifySessionToken(status.secret, (await cookies()).get(SESSION_COOKIE)?.value)
}

/**
 * Call first in every Server Action. A Server Action is a POST to the page's URL, so the proxy
 * alone is not enough: a refactor of its matcher must not leave the writes unprotected.
 */
export async function requireAuth(): Promise<void> {
  if (!(await isAuthenticated())) redirect("/login")
}
