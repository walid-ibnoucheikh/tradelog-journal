import { cacheLife, cacheTag } from "next/cache"
import Link from "next/link"
import { Suspense } from "react"
import { PageMotion } from "@/components/page-motion"
import { JournalSkeleton } from "@/components/skeletons"
import { ScrollToDay } from "@/components/journal/scroll-to-day"
import { DayCard } from "@/components/journal/day-card"
import { ExpandControls } from "@/components/journal/expand-controls"
import { JournalCalendar } from "@/components/journal/journal-calendar"
import { PageHeader } from "@/components/page-header"
import { TradesTable } from "@/components/trades/trades-table"
import { buttonVariants } from "@/components/ui/button"
import { DATA_TAG, PAGE_CACHE } from "@/db/cache"
import { getDayNotes, getTrades } from "@/db/queries"
import { accountParam, parseFilters, type Filters } from "@/lib/filters"
import { summarizeDay } from "@/lib/journal"
import { MONTH_PLACEHOLDER, monthKey, parseMonth, shiftMonth } from "@/lib/month"
import { computeStats, dayKey, monthCalendar } from "@/lib/trading/stats"

/** The URL is read here, outside the cache; the page content below only depends on these values. */
async function Journal({ searchParams }: { searchParams: PageProps<"/journal">["searchParams"] }) {
  const params = await searchParams
  const month = parseMonth(params.month)
  return (
    <JournalContent
      filters={parseFilters(params)}
      month={month ? monthKey(month.year, month.month) : null}
    />
  )
}

/** The whole page, built once and kept until data is written (see DATA_TAG). */
async function JournalContent({ filters, month }: { filters: Filters; month: string | null }) {
  "use cache"
  cacheTag(DATA_TAG)
  cacheLife(PAGE_CACHE)
  const { trades, allAccounts } = await getTrades({ ...filters, range: "all" })

  if (trades.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-10 text-center">
        <p className="font-medium">
          {allAccounts.length === 0 ? "No accounts yet." : "No trades yet."}
        </p>
        <p className="mb-4 text-sm text-muted-foreground">
          Each trading day will appear here with its statistics and your note.
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

  const { days } = computeStats(trades)
  const lastDay = days[days.length - 1].date
  const shown = parseMonth(month ?? undefined) ?? {
    year: Number(lastDay.slice(0, 4)),
    month: Number(lastDay.slice(5, 7)),
  }
  const key = monthKey(shown.year, shown.month)

  const byDay = new Map<string, typeof trades>()
  for (const trade of trades) {
    const day = dayKey(trade.closedAt)
    if (day.startsWith(key)) byDay.set(day, [...(byDay.get(day) ?? []), trade])
  }
  const summaries = [...byDay.entries()]
    .map(([day, dayTrades]) => summarizeDay(day, dayTrades))
    .sort((a, b) => b.date.localeCompare(a.date))
  const notes = await getDayNotes(key)
  // Account names are shown only when more than one account exists, as on the Trades page.
  const accountNames =
    allAccounts.length > 1
      ? new Map(allAccounts.map((account) => [account.id, account.name]))
      : null

  const href = (month: string) => {
    const next = new URLSearchParams()
    const account = accountParam(filters)
    if (account) next.set("account", account)
    next.set("month", month)
    return `/journal?${next}`
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <ScrollToDay />
      <div className="space-y-4">
        {summaries.length > 0 && <ExpandControls />}
        {summaries.length === 0 && (
          <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">
            No trades this month.
          </div>
        )}
        {summaries.map((day) => (
          <DayCard
            key={day.date}
            day={day}
            note={notes.get(day.date) ?? null}
            tradeList={
              <TradesTable trades={byDay.get(day.date) ?? []} accountNames={accountNames} compact />
            }
          />
        ))}
      </div>
      <div className="lg:sticky lg:top-6">
        <JournalCalendar
          weeks={monthCalendar(days, shown.year, shown.month)}
          year={shown.year}
          month={shown.month}
          previousHref={href(shiftMonth(shown.year, shown.month, -1))}
          nextHref={href(shiftMonth(shown.year, shown.month, 1))}
          monthHrefTemplate={href(MONTH_PLACEHOLDER)}
        />
      </div>
    </div>
  )
}

export default function JournalPage(props: PageProps<"/journal">) {
  return (
    <>
      <PageHeader title="Daily Journal" filters rangeFilter={false} />
      <PageMotion>
        <Suspense fallback={<JournalSkeleton />}>
          <Journal searchParams={props.searchParams} />
        </Suspense>
      </PageMotion>
    </>
  )
}
