"use client"

import { Loader2, RefreshCw } from "lucide-react"
import { useActionState } from "react"
import Link from "next/link"
import { requestSyncAction, type SyncActionState } from "@/app/(app)/import/sync-actions"
import { Button } from "@/components/ui/button"

/**
 * Asks the cloud sync for one more export of this account. Tradovate may remove a finished account
 * soon: what is not exported before then cannot be recovered.
 */
export function FinalSyncButton({
  accountId,
  label = "Sync one last time",
}: {
  accountId: string
  label?: string
}) {
  const [state, action, pending] = useActionState<SyncActionState, FormData>(requestSyncAction, {})
  return (
    <form action={action} className="inline-flex flex-wrap items-center gap-2">
      <input type="hidden" name="account" value={accountId} />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
        {label}
      </Button>
      {state.requested && (
        <span className="text-xs text-muted-foreground">
          Requested: follow it on{" "}
          <Link href="/import" className="underline">
            Import
          </Link>
          .
        </span>
      )}
      {state.error && (
        <span role="alert" className="text-xs text-destructive">
          {state.error}
        </span>
      )}
    </form>
  )
}
