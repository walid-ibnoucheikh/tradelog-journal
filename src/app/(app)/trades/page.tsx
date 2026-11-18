import { cacheLife, cacheTag } from "next/cache"
import Link from "next/link"
import { Suspense } from "react"
import { PageMotion } from "@/components/page-motion"
import { TradesSkeleton } from "@/components/skeletons"
import { PageHeader } from "@/components/page-header"
import { Pagination } from "@/components/pagination"
import { buttonVariants } from "@/components/ui/button"
import { TradesKpis } from "@/components/trades/trades-kpis"
import { TradesTable } from "@/components/trades/trades-table"
import { DATA_TAG, PAGE_CACHE } from "@/db/cache"
import { getTrades } from "@/db/queries"
import { accountParam, parseFilters, type Filters } from "@/lib/filters"
import { paginate, parsePage } from "@/lib/pagination"
import { computeStats } from "@/lib/trading/stats"
import { matchesStatus, parseStatus, type StatusFilter } from "@/lib/trading/trade"

/** The URL is read here, outside the cache; the page content below only depends on these values. */
async function TradeLog({ searchParams }: { searchParams: PageProps<"/trades">["searchParams"] }) {
  const params = await searchParams
  return (
    <TradeLogContent
      filters={parseFilters(params)}
      status={parseStatus(params.status)}
      requestedPage={parsePage(params.page)}
    />
  )
}

/** The whole page, built once and kept until data is written (see DATA_TAG). */
async function TradeLogContent({
  filters,
  status,
  requestedPage,
}: {
  filters: Filters
  status: StatusFilter
  requestedPage: number | null
}) {
  "use cache"
  cacheTag(DATA_TAG)
  cacheLife(PAGE_CACHE)
  const { trades: inRange, allAccounts } = await getTrades(filters)
  const trades = inRange.filter((trade) => matchesStatus(trade.status, status))

  if (trades.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-10 text-center">
        <p className="font-medium">
          {allAccounts.length === 0 ? "No accounts yet." : "No trades for this selection."}
        </p>
        <p className="mb-4 text-sm text-muted-foreground">
          {allAccounts.length === 0
            ? "Create an account, then import your Fills file from Tradovate."
            : "Change the filters or import new trades."}
        </p>
        <Link
          href={allAccounts.length === 0 ? "/accounts" : "/import"}
          className={buttonVariants()}
        >
          {allAccounts.length === 0 ? "Create an account" : "Import trades"}
        </Link>
      </div>
    )
  }

  const newestFirst = [...trades].reverse()
  const { page, pageCount, visible } = paginate(newestFirst, requestedPage)

  const pageHref = (target: number) => {
    const next = new URLSearchParams()
    const account = accountParam(filters)
    if (account) next.set("account", account)
    if (filters.range !== "all") next.set("range", filters.range)
    if (status !== "all") next.set("status", status)
    if (target > 1) next.set("page", String(target))
    return `/trades${next.size ? `?${next}` : ""}`
  }

  return (
    <div className="space-y-4">
      <TradesKpis stats={computeStats(trades)} />
      <TradesTable
        trades={visible}
        accountNames={
          allAccounts.length > 1
            ? new Map(allAccounts.map((account) => [account.id, account.name]))
            : null
        }
      />
      <Pagination
        page={page}
        pageCount={pageCount}
        total={trades.length}
        noun="trades"
        hrefFor={pageHref}
      />
    </div>
  )
}

export default function TradesPage(props: PageProps<"/trades">) {
  return (
    <>
      <PageHeader title="Trades" filters statusFilter />
      <PageMotion>
        <Suspense fallback={<TradesSkeleton />}>
          <TradeLog searchParams={props.searchParams} />
        </Suspense>
      </PageMotion>
    </>
  )
}
