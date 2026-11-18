import { TriangleAlert } from "lucide-react"
import Link from "next/link"
import { formatDay, formatImportTime, formatLongDay } from "@/lib/format"
import { formatAgo, importState } from "@/lib/accounts/import-freshness"
import { dayKey } from "@/lib/trading/stats"

/** When an account was last imported and, if that looks too old, a warning to import again. */
export function ImportFreshness({
  lastImportedAt,
  lastTradeAt,
  now,
}: {
  lastImportedAt: Date | null
  lastTradeAt: Date | null
  now: Date
}) {
  const state = importState(lastImportedAt, now)
  if (!lastImportedAt) {
    return (
      <p className="text-xs text-muted-foreground">
        No imports yet.{" "}
        <Link href="/import" className="underline">
          Import a file
        </Link>
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {state.state === "stale" && (
        <div
          role="alert"
          className="flex gap-2 rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3 text-xs"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-yellow-600 dark:text-yellow-400" />
          <p>
            <span className="font-medium">Re-import needed.</span> The last one was{" "}
            {formatAgo(lastImportedAt, now)}: the session of {formatLongDay(state.missedDay)} may
            not be imported.{" "}
            <Link href="/import" className="font-medium underline">
              Import
            </Link>
          </p>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Last import: {formatAgo(lastImportedAt, now)} ({formatImportTime(lastImportedAt)})
        {lastTradeAt && ` · last trade: ${formatDay(dayKey(lastTradeAt))}`}
      </p>
    </div>
  )
}
