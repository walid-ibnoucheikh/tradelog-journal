import { cacheLife, cacheTag } from "next/cache"
import { Suspense } from "react"
import { PageMotion } from "@/components/page-motion"
import { ContentSkeleton } from "@/components/skeletons"
import { OverviewReport } from "@/components/reports/overview"
import { ReportEmpty } from "@/components/reports/report-empty"
import { ReportHeader } from "@/components/reports/report-header"
import { DATA_TAG, PAGE_CACHE } from "@/db/cache"
import { getTrades } from "@/db/queries"
import { parseFilters, type Filters } from "@/lib/filters"
import { applyPnlMode, buildOverview, parsePnlMode, type PnlMode } from "@/lib/reports"

/** The URL is read here, outside the cache; the report below only depends on these values. */
async function Overview({ searchParams }: { searchParams: PageProps<"/reports">["searchParams"] }) {
  const params = await searchParams
  return <OverviewContent filters={parseFilters(params)} mode={parsePnlMode(params.pnl)} />
}

/** Built once and kept until data is written (see DATA_TAG). */
async function OverviewContent({ filters, mode }: { filters: Filters; mode: PnlMode }) {
  "use cache"
  cacheTag(DATA_TAG)
  cacheLife(PAGE_CACHE)
  const { trades, allAccounts } = await getTrades(filters)
  if (trades.length === 0) return <ReportEmpty hasAccounts={allAccounts.length > 0} />
  return <OverviewReport overview={buildOverview(applyPnlMode(trades, mode))} mode={mode} />
}

export default function ReportsPage(props: PageProps<"/reports">) {
  return (
    <>
      <ReportHeader title="Overview" />
      <PageMotion>
        <Suspense fallback={<ContentSkeleton />}>
          <Overview searchParams={props.searchParams} />
        </Suspense>
      </PageMotion>
    </>
  )
}
