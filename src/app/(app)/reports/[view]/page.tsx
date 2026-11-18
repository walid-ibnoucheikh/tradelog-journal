import { cacheLife, cacheTag } from "next/cache"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { PageMotion } from "@/components/page-motion"
import { ContentSkeleton } from "@/components/skeletons"
import { BreakdownReport, VIEW_TITLES } from "@/components/reports/breakdown"
import { ReportEmpty } from "@/components/reports/report-empty"
import { ReportHeader } from "@/components/reports/report-header"
import { DATA_TAG, PAGE_CACHE } from "@/db/cache"
import { getTrades } from "@/db/queries"
import { accountParam, parseFilters, type Filters } from "@/lib/filters"
import { parsePage } from "@/lib/pagination"
import {
  VIEWS,
  applyPnlMode,
  buildBreakdown,
  parsePnlMode,
  parseView,
  type PnlMode,
} from "@/lib/reports"

export function generateStaticParams() {
  return VIEWS.map((view) => ({ view }))
}

/** The URL is read here, outside the cache; the report below only depends on these values. */
async function Breakdown({ params, searchParams }: PageProps<"/reports/[view]">) {
  const view = parseView((await params).view)
  if (!view) notFound()
  const query = await searchParams
  return (
    <BreakdownContent
      view={view}
      filters={parseFilters(query)}
      mode={parsePnlMode(query.pnl)}
      requestedPage={parsePage(query.page)}
    />
  )
}

/** Built once and kept until data is written (see DATA_TAG). */
async function BreakdownContent({
  view,
  filters,
  mode,
  requestedPage,
}: {
  view: NonNullable<ReturnType<typeof parseView>>
  filters: Filters
  mode: PnlMode
  requestedPage: number | null
}) {
  "use cache"
  cacheTag(DATA_TAG)
  cacheLife(PAGE_CACHE)
  const { trades, allAccounts } = await getTrades(filters)
  if (trades.length === 0) return <ReportEmpty hasAccounts={allAccounts.length > 0} />
  // A link to another page of the table keeps the account, period and P&L choices.
  const pageHref = (target: number) => {
    const next = new URLSearchParams()
    const account = accountParam(filters)
    if (account) next.set("account", account)
    if (filters.range !== "all") next.set("range", filters.range)
    if (mode !== "net") next.set("pnl", mode)
    if (target > 1) next.set("page", String(target))
    return `/reports/${view}${next.size ? `?${next}` : ""}`
  }
  return (
    <BreakdownReport
      view={view}
      rows={buildBreakdown(view, applyPnlMode(trades, mode))}
      mode={mode}
      page={requestedPage}
      pageHref={pageHref}
    />
  )
}

async function Title({ params }: { params: PageProps<"/reports/[view]">["params"] }) {
  const view = parseView((await params).view)
  return <ReportHeader title={view ? VIEW_TITLES[view] : "Reports"} />
}

export default function ReportViewPage(props: PageProps<"/reports/[view]">) {
  return (
    <>
      <Suspense fallback={<ReportHeader title="Reports" />}>
        <Title params={props.params} />
      </Suspense>
      <PageMotion>
        <Suspense fallback={<ContentSkeleton />}>
          <Breakdown {...props} />
        </Suspense>
      </PageMotion>
    </>
  )
}
