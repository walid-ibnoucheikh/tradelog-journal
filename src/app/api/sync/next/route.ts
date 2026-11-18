import { claimNextRequest, syncTargets } from "@/db/sync"
import { loginsForKeys } from "@/db/tradovate-logins"
import { syncGuard } from "@/lib/sync/sync-guard"

/**
 * The cloud run's call: the oldest waiting request with the accounts and periods to export, and the
 * logins saved in the app for their prop firms, or null.
 */
export async function GET(request: Request) {
  const denied = await syncGuard(request)
  if (denied) return denied

  const { request: claimed } = await claimNextRequest()
  if (!claimed) return Response.json({ request: null })
  const accounts = await syncTargets(claimed)
  // The logins saved in the app, for the logins of this request only, by key (never listed anywhere else).
  const logins = await loginsForKeys(accounts.map((account) => account.loginKey))
  return Response.json({ request: { id: claimed.id, accounts, logins } })
}
