import { checkSyncToken } from "./sync-token"

/** First line of every sync-run route: null when the token is right, otherwise the response to send back. */
export async function syncGuard(request: Request): Promise<Response | null> {
  const auth = await checkSyncToken(process.env.SYNC_TOKEN, request.headers.get("authorization"))
  if (auth === "disabled")
    return Response.json({ error: "Sync is not configured." }, { status: 503 })
  if (auth === "unauthorized") return Response.json({ error: "Unauthorized" }, { status: 401 })
  return null
}
