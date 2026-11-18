import { ChevronRight } from "lucide-react"
import { connection } from "next/server"
import { Suspense } from "react"
import { ImportWorkspace } from "@/components/import/import-workspace"
import { InfoTip } from "@/components/info-tip"
import { PageHeader } from "@/components/page-header"
import { getLastTradeByAccount, getTradeResultsByAccount, listAccounts } from "@/db/queries"
import { getSyncHistory, getSyncOverview } from "@/db/sync"
import { accountSuggestions } from "@/lib/accounts/suggestions"
import { syncMode } from "@/lib/sync/cloud-dispatch"
import { MIN_SYNC_TOKEN_LENGTH } from "@/lib/sync/sync-token"
import { ImportForm } from "./import-form"
import { LoginsCard } from "./logins-card"

/** How the Sync buttons work here, or null when they cannot: they need the token and, online, the GitHub settings. */
const currentSyncMode = () =>
  (process.env.SYNC_TOKEN ?? "").length >= MIN_SYNC_TOKEN_LENGTH ? syncMode(process.env) : null

async function Overview() {
  await connection() // the status depends on the current time
  await getSyncOverview() // closes the requests nobody works on any more
  const [accounts, lastTrades, history, results] = await Promise.all([
    listAccounts(),
    getLastTradeByAccount(),
    getSyncHistory(),
    getTradeResultsByAccount(),
  ])
  return (
    <ImportWorkspace
      mode={currentSyncMode()}
      now={new Date().toISOString()}
      accounts={accounts.map((account) => ({
        id: account.id,
        name: account.name,
        firm: account.firm,
        type: account.type,
        status: account.status,
        lastImportedAt: account.lastImportedAt?.toISOString() ?? null,
        lastTradeAt: lastTrades.get(account.id)?.toISOString() ?? null,
        endedAt: account.endedAt,
        notFoundAt: account.notFoundAt?.toISOString() ?? null,
      }))}
      suggestions={accountSuggestions(accounts, results)}
      runs={history.map((run) => ({
        ...run,
        requestedAt: run.requestedAt.toISOString(),
        finishedAt: run.finishedAt?.toISOString() ?? null,
      }))}
    />
  )
}

export default function ImportPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Import" />
      <Suspense fallback={null}>
        <Overview />
      </Suspense>
      <Suspense fallback={null}>
        <LoginsCard />
      </Suspense>
      {/* Folded when the automatic sync is set up: it is the fallback, not the daily way. */}
      <details open={currentSyncMode() === null} className="group rounded-xl border bg-card">
        <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl px-5 py-4 [&::-webkit-details-marker]:hidden">
          <ChevronRight className="size-4 text-muted-foreground transition-transform group-open:rotate-90" />
          <h2 className="flex items-center gap-1.5 text-base font-medium">
            Import files by hand
            <InfoTip label="About the import">
              <p>
                <span className="font-medium">No duplicates:</span> re-importing duplicates nothing
                (export the last 7 days).
              </p>
              <p>
                <span className="font-medium">Cash History:</span> exchange, clearing and NFA fees.
                Without it, net P&amp;L is too optimistic.
              </p>
            </InfoTip>
          </h2>
        </summary>
        <div className="space-y-4 px-5 pb-5">
          <p className="text-sm text-muted-foreground">
            Export Fills and Cash History from Tradovate for the same period and drop them together:
            each one is recognised by its content, and the account by the name it holds. One file
            alone is fine too.
          </p>
          <ImportForm />
        </div>
      </details>
    </div>
  )
}
