import { Plus } from "lucide-react"
import { cacheLife, cacheTag } from "next/cache"
import Link from "next/link"
import { Suspense } from "react"
import { PageMotion } from "@/components/page-motion"
import { InvestmentsSkeleton } from "@/components/skeletons"
import { AreaSeries, ChartCard } from "@/components/dashboard/charts"
import { AccountsTable } from "@/components/investments/accounts-table"
import { FirmsTable } from "@/components/investments/firms-table"
import { FirmRoiChart, MonthlyCashChart } from "@/components/investments/investment-charts"
import { InvestmentKpis } from "@/components/investments/investment-kpis"
import { PeriodSelect } from "@/components/investments/period-select"
import { OutsidePropFirmSection } from "@/components/investments/outside-prop-firm"
import { Registry } from "@/components/investments/registry"
import { RegistryFilters } from "@/components/investments/registry-filters"
import { ModalButton } from "@/components/modal"
import { PageHeader } from "@/components/page-header"
import { DATA_TAG, PAGE_CACHE } from "@/db/cache"
import { getTradeResultsByAccount, listAccounts, listTransactions } from "@/db/queries"
import { USER_TIMEZONE, today } from "@/lib/day"
import { formatDay, formatUsd } from "@/lib/format"
import { buildInvestmentReport } from "@/lib/investments/investment-report"
import { breakEvenDay, cumulativeNet, monthlyCash } from "@/lib/investments/investment-series"
import {
  filterTransactions,
  parseRegistryFilters,
  registryNet,
  registryOptions,
  type RegistryFilters as RegistryFilterValues,
} from "@/lib/investments/registry"
import { providerSuggestions } from "@/lib/investments/investments"
import { paginate } from "@/lib/pagination"
import {
  inRange,
  parsePeriod,
  type Period,
  periodLabel,
  periodRange,
  periodYears,
  tradingPnlInPeriod,
} from "@/lib/investments/period"
import { cn } from "@/lib/utils"
import { TransactionForm } from "./transaction-form"

type Tab = "analyse" | "registre"

const TABS: { value: Tab; label: string; href: string }[] = [
  { value: "analyse", label: "Analysis", href: "/investments" },
  { value: "registre", label: "Registry", href: "/investments?tab=registre" },
]

async function AddTransaction() {
  "use cache"
  cacheTag(DATA_TAG)
  cacheLife(PAGE_CACHE)
  const [accounts, transactions] = await Promise.all([listAccounts(), listTransactions()])
  return (
    <ModalButton
      label="Add transaction"
      icon={<Plus />}
      title="Add transaction"
      description="Real money: a prop firm purchase, reset or payout, or spending outside prop firms (education, mentor, tools)."
      wide
    >
      <TransactionForm
        accounts={accounts.map(({ id, name, firm }) => ({ id, name, firm }))}
        providers={providerSuggestions(transactions)}
        today={today(USER_TIMEZONE)}
      />
    </ModalButton>
  )
}

function Tabs({ tab }: { tab: Tab }) {
  return (
    <nav aria-label="Investments" className="flex gap-1 border-b">
      {TABS.map((item) => (
        <Link
          key={item.value}
          href={item.href}
          aria-current={tab === item.value ? "page" : undefined}
          className={cn(
            "-mb-px inline-flex min-h-10 items-center border-b-2 border-transparent px-4 text-sm text-muted-foreground hover:text-foreground",
            tab === item.value && "border-primary font-medium text-foreground"
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  )
}

/** The URL is read here, outside the cache; the page content below only depends on these values. */
async function Investments({
  searchParams,
}: {
  searchParams: PageProps<"/investments">["searchParams"]
}) {
  const params = await searchParams
  return (
    <InvestmentsContent
      tab={params.tab === "registre" ? "registre" : "analyse"}
      period={parsePeriod(params.period)}
      registry={parseRegistryFilters(params)}
    />
  )
}

/** The whole page, built once and kept until data is written (see DATA_TAG). */
async function InvestmentsContent({
  tab,
  period,
  registry,
}: {
  tab: Tab
  period: Period
  registry: RegistryFilterValues
}) {
  "use cache"
  cacheTag(DATA_TAG)
  cacheLife(PAGE_CACHE)
  const [accounts, rows, tradeResults] = await Promise.all([
    listAccounts(),
    listTransactions(),
    getTradeResultsByAccount(),
  ])

  if (tab === "registre") {
    const filters = registry
    const filtered = filterTransactions(rows, filters)
    const current = paginate(filtered, filters.page)
    const options = registryOptions(rows)
    const pageHref = (page: number) => {
      const next = new URLSearchParams({ tab: "registre" })
      if (filters.firm) next.set("firm", filters.firm)
      if (filters.accountId) next.set("account", filters.accountId)
      if (filters.year) next.set("year", filters.year)
      if (page > 1) next.set("page", String(page))
      return `/investments?${next}`
    }
    return (
      <div className="space-y-4">
        <Tabs tab={tab} />
        {rows.length === 0 ? (
          <p className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
            No transactions yet. Add your first purchase or payout with the button at the top right.
          </p>
        ) : (
          <>
            <RegistryFilters
              firms={options.firms}
              accounts={accounts.map(({ id, name }) => ({ id, name }))}
              years={options.years}
            />
            <Registry
              rows={current.visible}
              total={filtered.length}
              net={registryNet(filtered)}
              page={current.page}
              pageCount={current.pageCount}
              pageHref={pageHref}
            />
          </>
        )}
      </div>
    )
  }

  const todayDay = today(USER_TIMEZONE)
  const range = periodRange(period, todayDay)
  const report = buildInvestmentReport({
    accounts,
    transactions: rows,
    tradingPnl: tradingPnlInPeriod(tradeResults, range),
    period: range,
  })
  const scoped = rows.filter((row) => inRange(row.day, range))
  const netSeries = cumulativeNet(scoped)
  const breakEven = breakEvenDay(netSeries)
  const roiByFirm = report.firmRows.flatMap((row) =>
    row.roi === null ? [] : [{ firm: row.firm, roi: Math.round(row.roi * 100) / 100 }]
  )

  return (
    <div className="space-y-6">
      <Tabs tab={tab} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {range === null
            ? "Whole history"
            : `${periodLabel(period)}: ${formatDay(range.from)}, ${range.from.slice(0, 4)} to ${formatDay(range.to)}, ${range.to.slice(0, 4)}`}
          {" · "}
          {scoped.length} transaction{scoped.length > 1 ? "s" : ""}
        </p>
        <PeriodSelect
          years={periodYears(
            rows.map((row) => row.day),
            todayDay
          )}
        />
      </div>
      <InvestmentKpis report={report} />

      {scoped.length === 0 && range !== null && (
        <p className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
          No transactions in this period.
        </p>
      )}

      {scoped.length > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <ChartCard title="Cumulative net (real money)" className="lg:col-span-2">
            <p className="mb-2 text-sm text-muted-foreground">
              {range !== null
                ? `Net for the period: ${formatUsd(report.net)}`
                : breakEven
                  ? `Paid back since ${formatDay(breakEven)}, ${breakEven.slice(0, 4)}`
                  : report.net >= 0
                    ? "Never below zero"
                    : "Not paid back yet"}
            </p>
            <AreaSeries
              data={netSeries}
              color={report.net >= 0 ? "var(--profit)" : "var(--loss)"}
            />
          </ChartCard>
          <ChartCard title="ROI by prop firm">
            {roiByFirm.length > 0 ? (
              <FirmRoiChart data={roiByFirm} />
            ) : (
              <p className="py-16 text-center text-sm text-muted-foreground">No data.</p>
            )}
          </ChartCard>
          <ChartCard title="Spending and payouts by month" className="lg:col-span-3">
            <MonthlyCashChart data={monthlyCash(scoped)} />
          </ChartCard>
        </div>
      )}

      <section className="space-y-4 rounded-xl border bg-card p-5">
        <h2 className="text-lg font-medium">By account</h2>
        <p className="text-sm text-muted-foreground">
          Net counts real money (payouts minus spending). The trading P&amp;L of an evaluation is
          virtual: it earns nothing until the account is paid out.
        </p>
        <AccountsTable report={report} />
      </section>

      <section className="space-y-4 rounded-xl border bg-card p-5">
        <h2 className="text-lg font-medium">By prop firm</h2>
        <FirmsTable report={report} />
      </section>

      {report.outsidePropFirm && <OutsidePropFirmSection data={report.outsidePropFirm} />}
    </div>
  )
}

export default function InvestmentsPage(props: PageProps<"/investments">) {
  return (
    <>
      <PageHeader
        title="Investments"
        action={
          <Suspense fallback={<div className="h-8 w-48" />}>
            <AddTransaction />
          </Suspense>
        }
      />
      <PageMotion>
        <Suspense fallback={<InvestmentsSkeleton />}>
          <Investments searchParams={props.searchParams} />
        </Suspense>
      </PageMotion>
    </>
  )
}
