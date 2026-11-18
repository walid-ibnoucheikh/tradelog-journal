import { requestSync } from "@/db/sync"
import { syncGuard } from "@/lib/sync/sync-guard"

/**
 * The scheduled cloud run's call: queue a sync of all active accounts, which it then takes through
 * `/next` like a request made by a button. A request already waiting or running is returned instead.
 * Only the sync queue changes here, no cached data.
 */
export async function POST(request: Request) {
  const denied = await syncGuard(request)
  if (denied) return denied

  const queued = await requestSync()
  return Response.json({ id: queued.id, status: queued.status })
}
