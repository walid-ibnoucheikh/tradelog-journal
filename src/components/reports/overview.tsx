import { AreaSeries, ChartCard, DailyPnlBars } from "@/components/dashboard/charts"
import { KpiCard, profitFactorLabel } from "@/components/dashboard/kpi-cards"
import { formatDuration, formatLongMonth, formatUsd, pnlColor } from "@/lib/format"
import type { Overview as OverviewData, PnlMode } from "@/lib/reports"
import { StatTable, type StatRow } from "./stat-table"

const money = (value: number | null): Pick<StatRow, "value" | "className"> =>
  value === null ? { value: "—" } : { value: formatUsd(value), className: pnlColor(value) }

const hold = (milliseconds: number | null) =>
  milliseconds === null ? "—" : formatDuration(milliseconds)

const monthRow = (label: string, month: { month: string; pnl: number } | null): StatRow[] => [
  { label: `Month with the ${label} P&L`, value: month ? formatLongMonth(month.month) : "—" },
  {
    label: `${label === "highest" ? "Max P&L" : "Min P&L"} of the month`,
    ...money(month?.pnl ?? null),
  },
]

/** The "Vue d'ensemble" report: best and worst month, two tables of all-time figures, two charts. */
export function OverviewReport({ overview, mode }: { overview: OverviewData; mode: PnlMode }) {
  const { stats } = overview
  const kind = mode === "gross" ? "gross" : "net"

  const trades: StatRow[] = [
    { label: `Total ${kind} P&L`, ...money(overview.totalPnl) },
    { label: "Number of trades", value: stats.tradeCount },
    { label: "Average win", ...money(stats.wins ? stats.avgWin : null) },
    { label: "Average loss", ...money(stats.losses ? -stats.avgLoss : null) },
    { label: "Winning trades", value: stats.wins },
    { label: "Losing trades", value: stats.losses },
    { label: "Break-even trades", value: stats.breakeven },
    { label: "Commissions and fees", value: formatUsd(overview.commissions) },
    { label: "Largest win", ...money(overview.largestWin) },
    { label: "Largest loss", ...money(overview.largestLoss) },
    { label: "Average P&L per trade", ...money(overview.avgTradePnl) },
    { label: "Profit factor", value: profitFactorLabel(stats) },
    { label: "Average duration (winners)", value: hold(overview.avgHold.winning) },
    { label: "Average duration (losers)", value: hold(overview.avgHold.losing) },
  ]
  const days: StatRow[] = [
    { label: "Traded days", value: stats.days.length },
    { label: "Winning days", value: stats.winningDays },
    { label: "Losing days", value: stats.losingDays },
    { label: "Zero days", value: stats.breakevenDays },
    { label: "Average P&L per day", ...money(overview.avgDailyPnl) },
    {
      label: "Average trades per day",
      value: stats.days.length ? (stats.tradeCount / stats.days.length).toFixed(1) : "—",
    },
    { label: "Best day", ...money(overview.largestWinningDay) },
    { label: "Worst day", ...money(overview.largestLosingDay) },
    ...monthRow("highest", overview.bestMonth),
    ...monthRow("lowest", overview.worstMonth),
    { label: "Average P&L per month", ...money(overview.avgPerMonth) },
    { label: "Average duration (all)", value: hold(overview.avgHold.all) },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
        <KpiCard title="Best month">
          <p
            className={`text-xl font-semibold sm:text-2xl ${pnlColor(overview.bestMonth?.pnl ?? 0)}`}
          >
            {overview.bestMonth ? formatUsd(overview.bestMonth.pnl) : "—"}
          </p>
        </KpiCard>
        <KpiCard title="Worst month">
          <p
            className={`text-xl font-semibold sm:text-2xl ${pnlColor(overview.worstMonth?.pnl ?? 0)}`}
          >
            {overview.worstMonth ? formatUsd(overview.worstMonth.pnl) : "—"}
          </p>
        </KpiCard>
        <KpiCard title="Average per month" hero>
          <p className={`text-xl font-semibold sm:text-2xl ${pnlColor(overview.avgPerMonth ?? 0)}`}>
            {overview.avgPerMonth === null ? "—" : formatUsd(overview.avgPerMonth)}
          </p>
        </KpiCard>
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <StatTable title="Trades" rows={trades} />
        <StatTable title="Days and months" rows={days} />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title={`Cumulative ${kind} P&L by day`}>
          <AreaSeries data={stats.cumulative} />
        </ChartCard>
        <ChartCard title={`${kind[0].toUpperCase()}${kind.slice(1)} P&L by day`}>
          <DailyPnlBars data={stats.days.map((day) => ({ date: day.date, value: day.netPnl }))} />
        </ChartCard>
      </div>
    </div>
  )
}
