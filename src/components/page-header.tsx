import { cacheLife, cacheTag } from "next/cache"
import { Suspense } from "react"
import { DATA_TAG, PAGE_CACHE } from "@/db/cache"
import { listAccounts } from "@/db/queries"
import { FilterBar } from "./filter-bar"

async function Filters({
  statusFilter,
  rangeFilter,
}: {
  statusFilter: boolean
  rangeFilter: boolean
}) {
  // Cached: the account list is needed on most pages and only changes when accounts do.
  "use cache"
  cacheTag(DATA_TAG)
  cacheLife(PAGE_CACHE)
  const accounts = await listAccounts()
  return (
    <FilterBar
      accounts={accounts.map(({ id, name, firm, status, type, initialBalance }) => ({
        id,
        name,
        firm,
        status,
        type,
        initialBalance,
      }))}
      statusFilter={statusFilter}
      rangeFilter={rangeFilter}
    />
  )
}

export function PageHeader({
  title,
  filters = false,
  statusFilter = false,
  rangeFilter = true,
  action,
}: {
  title: string
  filters?: boolean
  /** Adds a WIN / LOSS / BE select next to the period and account filters. */
  statusFilter?: boolean
  /** Set to false on pages that browse by month instead of by period. */
  rangeFilter?: boolean
  /** Main button of the page, shown at the far right. */
  action?: React.ReactNode
}) {
  return (
    <>
      {/* The tab title of the page: React places it in <head>, and the loading state of the same page
          renders the same one, so it does not move while the page streams in. */}
      <title>{`${title} · Tradelog`}</title>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <div className="flex items-center gap-3">
          {filters && (
            <Suspense fallback={<div className="h-9" />}>
              <Filters statusFilter={statusFilter} rangeFilter={rangeFilter} />
            </Suspense>
          )}
          {action}
        </div>
      </div>
    </>
  )
}
