"use server"

import { refresh } from "next/cache"
import { headers } from "next/headers"
import { requireAuth } from "@/lib/auth/auth"
import { cancelOpenRequests, requestSync } from "@/db/sync"
import { dispatchCloudSync, loadCloudSync, syncMode } from "@/lib/sync/cloud-dispatch"
import { startLocalRun } from "@/lib/sync/local-run"
import { isUuid } from "@/lib/sync/sync-input"
import { MIN_SYNC_TOKEN_LENGTH } from "@/lib/sync/sync-token"

export interface SyncActionState {
  error?: string
  /** True once the request was made, so a button elsewhere can say so. */
  requested?: boolean
}

/**
 * A "Sync" button: asks for one account, one prop firm, or all active accounts to be exported from
 * Tradovate and imported. The request is queued, then the "Cloud sync" GitHub workflow is started:
 * it takes the request, does the export in a GitHub runner and sends the files back. In
 * development the same run is started on this PC instead (see `syncMode`, `startLocalRun`).
 */
export async function requestSyncAction(
  _previous: SyncActionState,
  formData: FormData
): Promise<SyncActionState> {
  await requireAuth()
  const choice = formData.get("account")
  const accountId = typeof choice === "string" && choice !== "all" ? choice : null
  if (accountId !== null && !isUuid(accountId)) return { error: "Unknown account." }
  const named = formData.get("firm")
  const firm = typeof named === "string" && named.trim() ? named.trim().slice(0, 100) : null
  if ((process.env.SYNC_TOKEN ?? "").length < MIN_SYNC_TOKEN_LENGTH) {
    return { error: "Sync is not set up: SYNC_TOKEN is missing." }
  }
  const mode = syncMode(process.env)
  if (!mode) {
    return { error: "Sync is not set up: CLOUD_SYNC_REPO or CLOUD_SYNC_TOKEN is missing." }
  }

  const request = await requestSync({ accountId, firm })
  // A request already waiting or running is returned instead of a new one: its run is on its way.
  const cloudSync = mode === "cloud" ? loadCloudSync(process.env) : null
  if (cloudSync && request.status === "pending") {
    const started = await dispatchCloudSync(cloudSync)
    if (!started.ok) {
      // Nothing is running for this request: drop it rather than leave it waiting.
      await cancelOpenRequests()
      refresh()
      return { error: `The cloud run did not start. ${started.error}` }
    }
  }
  if (mode === "local" && request.status === "pending") {
    const started = startLocalRun((await headers()).get("host"))
    if (!started.ok) {
      await cancelOpenRequests()
      refresh()
      return { error: started.error }
    }
  }
  refresh()
  return { requested: true }
}

/** The "Cancel" button: drop the waiting or running request. */
export async function cancelSyncAction() {
  await requireAuth()
  await cancelOpenRequests()
  refresh()
}
