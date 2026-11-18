import { invalidateData } from "@/db/cache"
import { finishRequest, recordEmptyImports, recordPresence } from "@/db/sync"
import { syncGuard } from "@/lib/sync/sync-guard"
import { isUuid, parseFinish } from "@/lib/sync/sync-input"

/** The cloud run reports how a request ended: `{ status: "done" | "failed" | "needs_login", message }`. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await syncGuard(request)
  if (denied) return denied

  const { id } = await params
  if (!isUuid(id)) return Response.json({ error: "Bad request id." }, { status: 400 })
  const finish = parseFinish(await request.json().catch(() => null))
  if (!finish) return Response.json({ error: "Bad outcome." }, { status: 400 })

  const closed = await finishRequest(id, finish.status, finish.message)
  if (!closed) return Response.json({ error: "This request is not running." }, { status: 409 })
  // What the cloud run saw of the accounts is kept on them, so the app can point out a missing one.
  await recordPresence(finish.found, finish.missing)
  await recordEmptyImports(finish.empty)
  invalidateData()
  return Response.json({ ok: true })
}
