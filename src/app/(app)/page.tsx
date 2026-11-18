import { cacheLife, cacheTag } from "next/cache"
import Link from "next/link"
import { Suspense } from "react"
import { PageMotion } from "@/components/page-motion"
import { ChartCard, AreaSeries, DailyPnlBars, TimePerformance } from "@/components/dashboard/charts"
import { BalanceChart } from "@/components/dashboard/balance-charts"
import { KpiCards } from "@/components/dashboard/kpi-cards"
import { ScoreCard } from "@/components/dashboard/score-card"
import { PnlCalendar } from "@/components/dashboard/pnl-calendar"
import { RecentTrades } from "@/components/dashboard/recent-trades"
import { PageHeader } from "@/components/page-header"
import { ImportStatus } from "@/components/import-status"
import { DashboardSkeleton } from "@/components/skeletons"
import { buttonVariants } from "@/components/ui/button"
import { DATA_TAG, PAGE_CACHE } from "@/db/cache"
import { getTradeResultsByAccount, getTrades } from "@/db/queries"
import { buildBalanceSeries, clipToPeriod, sumBalances } from "@/lib/accounts/balance-series"
import {
  accountParam,
  defaultScopeFor,
  parseFilters,
  rangeBounds,
  type Filters,
} from "@/lib/filters"
import { DAY_PLACEHOLDER, MONTH_PLACEHOLDER, monthKey, parseMonth } from "@/lib/month"
import { sampleEvenly } from "@/lib/sample"
import { computeScore } from "@/lib/trading/score"
import { computeStats, hourOfDay } from "@/lib/trading/stats"

/** The URL is read here, outside the cache; the page content below only depends on these values. */
async function Dashboard({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const params = await searchParams
  const month = parseMonth(params.month)
  return (
    <DashboardContent
      filters={parseFilters(params, defaultScopeFor("/"))}
      month={month ? monthKey(month.year, month.month) : null}
    />
  )
}

/**
 * The whole page, built once and kept until data is written (DATA_TAG). The clock is read in here, so
 * "now" is the moment it was built. The URL and the page are separate so the content can be cached.
 */
async function DashboardContent({ filters, month }: { filters: Filters; month: string | null }) {
  "use cache"
  cacheTag(DATA_TAG)
  cacheLife(PAGE_CACHE)
  const { trades, accounts, allAccounts } = await getTrades(filters)

  if (trades.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-10 text-center">
        <p className="font-medium">
          {allAccounts.length === 0 ? "No accounts yet." : "No trades for this selection."}
        </p>
        <p className="mb-4 text-sm text-muted-foreground">
          {allAccounts.length === 0
            ? "Create an account, then import your Fills file from Tradovate."
            : "Change the period or the account, or import new trades."}
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

  const stats = computeStats(trades)
  // One point per trade; above 1,500 trades an even sample is drawn and the chart says how many it shows.
  const timePoints = trades.map((trade) => ({ hour: hourOfDay(trade.openedAt), pnl: trade.netPnl }))
  const sampledTimePoints = sampleEvenly(timePoints, 1_500)

  // Balance chart: the account when one is selected, else the sum of the active accounts. Balances come from
  // each account's whole history, so a period filter only crops what is drawn.
  const results = await getTradeResultsByAccount()
  const { from, to } = rangeBounds(filters.range)
  const balanceAccounts = filters.accountId
    ? accounts
    : accounts.filter((account) => account.status === "active")
  const balancePoints = clipToPeriod(
    sumBalances(
      balanceAccounts.map((account) => ({
        initialBalance: account.initialBalance,
        points: buildBalanceSeries(account.initialBalance, results.get(account.id) ?? []),
      }))
    ),
    from,
    to
  )
  const balanceStart = balanceAccounts.reduce((sum, account) => sum + account.initialBalance, 0)

  const lastDay = stats.days[stats.days.length - 1].date
  const shown = parseMonth(month ?? undefined) ?? {
    year: Number(lastDay.slice(0, 4)),
    month: Number(lastDay.slice(5, 7)),
  }
  // A traded day opens its window (note and trades) over the Daily Journal: see DayNoteDialog.
  // The calendar fills in the month and the day itself (it switches month without the server).
  const dayHrefTemplate = (() => {
    const next = new URLSearchParams()
    const account = accountParam(filters)
    if (account) next.set("account", account)
    next.set("month", MONTH_PLACEHOLDER)
    return `/journal?${next}#note-${DAY_PLACEHOLDER}`
  })()

  return (
    <div className="space-y-4">
      {/* One account selected: its own import; all accounts: the oldest import among the active ones. */}
      <ImportStatus
        accounts={filters.accountId ? accounts : accounts.filter((a) => a.status === "active")}
        now={new Date()}
      />
      <KpiCards stats={stats} />
      <div className="stagger grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ScoreCard score={computeScore(stats)} />
        <ChartCard
          title="Daily net cumulative P&L"
          info={<p>Running total of your daily net P&amp;L, after fees.</p>}
          className="lg:col-span-2"
        >
          <AreaSeries data={stats.cumulative} />
        </ChartCard>
        <ChartCard
          title="Net daily P&L"
          info={<p>Net P&amp;L of each trading day. A day runs from 6 pm to 5 pm New York time.</p>}
        >
          <DailyPnlBars data={stats.days.map((day) => ({ date: day.date, value: day.netPnl }))} />
        </ChartCard>
        {/* On a phone and a tablet (one column) the recent trades and the calendar come right after the figures. */}
        <RecentTrades trades={trades} className="max-lg:-order-2" />
        <ChartCard
          title={balanceAccounts.length > 1 ? "Accounts balance" : "Account balance"}
          info={<p>Initial balance plus the cumulative net P&amp;L of the selected account(s).</p>}
        >
          <BalanceChart points={balancePoints} initialBalance={balanceStart} />
        </ChartCard>
        <div className="flex min-w-0 max-lg:-order-1 lg:col-span-2">
          <PnlCalendar days={stats.days} initialMonth={shown} dayHrefTemplate={dayHrefTemplate} />
        </div>
        <div className="flex flex-col gap-4">
          <ChartCard
            title="Drawdown"
            className="flex-1"
            info={<p>How far the cumulative P&amp;L is below its highest point so far.</p>}
          >
            <AreaSeries data={stats.drawdown} color="var(--loss)" />
          </ChartCard>
          <ChartCard
            title="Trade time performance"
            className="flex-1"
            info={<p>Net P&amp;L of each trade by the hour it was opened (New York time).</p>}
          >
            <TimePerformance data={sampledTimePoints} total={timePoints.length} />
          </ChartCard>
        </div>
      </div>
    </div>
  )
}

export default function Home(props: PageProps<"/">) {
  return (
    <>
      <PageHeader title="Dashboard" filters />
      <PageMotion>
        <Suspense fallback={<DashboardSkeleton />}>
          <Dashboard searchParams={props.searchParams} />
        </Suspense>
      </PageMotion>
    </>
  )
}
