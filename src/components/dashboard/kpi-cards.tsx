import { Card } from "@/components/ui/card"
import { AvgWinLossBar, Donut, SemiGauge, type GaugeLabels } from "./gauges"

export { Donut, SemiGauge }

/** Hover feel shared by every KPI card: a slight lift and shadow. Visible overflow so hover labels are not clipped. */
export const kpiCard =
  "relative overflow-visible transition-[transform,box-shadow] duration-200 hover:z-10 hover:-translate-y-0.5 hover:shadow-md"

const DAY_LABELS: GaugeLabels = {
  win: ["winning day", "winning days"],
  be: ["break-even day", "break-even days"],
  loss: ["losing day", "losing days"],
}
import { formatPercent, formatUsd, pnlColor } from "@/lib/format"
import type { Stats } from "@/lib/trading/stats"
import { cn } from "@/lib/utils"

export function KpiCard({
  title,
  badge,
  aside,
  stacked = false,
  hero = false,
  children,
}: {
  title: React.ReactNode
  badge?: number
  aside?: React.ReactNode
  /** Title on its own line on top, then the figure with the aside on its right: for a long title or a wide aside. */
  stacked?: boolean
  /**
   * The main figure of a row of cards. On a phone the cards sit two by two to save room: a hero takes the
   * whole row and keeps its gauge; the others drop theirs (the figure is what matters at that size).
   */
  hero?: boolean
  children: React.ReactNode
}) {
  const heading = (
    <div className="flex items-center gap-2 text-sm text-muted-foreground sm:whitespace-nowrap">
      {title}
      {badge !== undefined && <span className="rounded bg-muted px-1.5 text-xs">{badge}</span>}
    </div>
  )

  if (stacked) {
    return (
      <Card className={cn(kpiCard, hero && "col-span-2 sm:col-span-1", "gap-1 p-4 sm:p-5")}>
        {heading}
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">{children}</div>
          {aside && <div className={cn("shrink-0", !hero && "max-sm:hidden")}>{aside}</div>}
        </div>
      </Card>
    )
  }

  return (
    <Card
      className={cn(
        kpiCard,
        hero && "col-span-2 sm:col-span-1",
        // Phone: a card without gauge is top-aligned, so next to a taller one its title stays on the same line.
        !hero && "max-sm:items-start",
        "flex-row items-center justify-between gap-3 p-4 sm:gap-6 sm:p-5"
      )}
    >
      <div className="min-w-0 flex-1 space-y-1">
        {heading}
        {children}
      </div>
      {aside && <div className={cn("shrink-0", !hero && "max-sm:hidden")}>{aside}</div>}
    </Card>
  )
}

export function profitFactorLabel(stats: Stats) {
  if (stats.profitFactor !== null) return stats.profitFactor.toFixed(2)
  return stats.grossProfit > 0 ? "∞" : "—"
}

/** Average win/loss card: title on top, then the ratio on the left and the win/loss bar on the right (safe on narrow cards). */
/** `wide`: on a phone the card takes a whole row and keeps its bar (the Trades page has an odd number of cards). */
export function AvgWinLossCard({ stats, wide = false }: { stats: Stats; wide?: boolean }) {
  return (
    <KpiCard title="Avg win/loss trade" hero={wide}>
      <div className="flex items-end justify-between gap-3">
        <p className="text-xl font-semibold sm:text-2xl">
          {stats.avgWinLossRatio === null ? "—" : stats.avgWinLossRatio.toFixed(2)}
        </p>
        <div className={wide ? undefined : "max-sm:hidden"}>
          <AvgWinLossBar avgWin={stats.avgWin} avgLoss={stats.avgLoss} />
        </div>
      </div>
    </KpiCard>
  )
}

export function KpiCards({ stats }: { stats: Stats }) {
  const profitFactor = profitFactorLabel(stats)

  return (
    <div className="stagger grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3 2xl:grid-cols-5">
      <KpiCard title="Net P&L" badge={stats.tradeCount} hero>
        <p className={cn("text-xl font-semibold sm:text-2xl", pnlColor(stats.netPnl))}>
          {formatUsd(stats.netPnl)}
        </p>
      </KpiCard>

      <KpiCard
        title="Trade win %"
        aside={<SemiGauge wins={stats.wins} breakeven={stats.breakeven} losses={stats.losses} />}
      >
        <p className="text-xl font-semibold sm:text-2xl">{formatPercent(stats.winRate)}</p>
      </KpiCard>

      <KpiCard
        title="Profit factor"
        aside={<Donut profit={stats.grossProfit} loss={stats.grossLoss} />}
      >
        <p className="text-xl font-semibold sm:text-2xl">{profitFactor}</p>
      </KpiCard>

      <KpiCard
        title="Day win %"
        aside={
          <SemiGauge
            wins={stats.winningDays}
            breakeven={stats.breakevenDays}
            losses={stats.losingDays}
            labels={DAY_LABELS}
          />
        }
      >
        <p className="text-xl font-semibold sm:text-2xl">{formatPercent(stats.dayWinRate)}</p>
      </KpiCard>

      <AvgWinLossCard stats={stats} />
    </div>
  )
}
