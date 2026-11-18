import {
  AvgWinLossCard,
  Donut,
  KpiCard,
  SemiGauge,
  profitFactorLabel,
} from "@/components/dashboard/kpi-cards"
import { formatPercent, formatUsd, pnlColor } from "@/lib/format"
import type { Stats } from "@/lib/trading/stats"
import { cn } from "@/lib/utils"

/** Tiny line of the cumulative P&L, scaled to its own min and max. */
function Sparkline({ values, positive }: { values: number[]; positive: boolean }) {
  const color = positive ? "var(--profit)" : "var(--loss)"
  const min = Math.min(...values)
  const range = Math.max(...values) - min || 1
  const points = values.map((value, index) => {
    const x = values.length === 1 ? 0 : (index / (values.length - 1)) * 120
    return `${x},${36 - ((value - min) / range) * 32}`
  })
  const line = points.join(" ")
  return (
    <svg viewBox="0 0 120 40" className="h-10 w-20 shrink-0" aria-hidden>
      <polygon points={`0,40 ${line} 120,40`} fill={color} opacity="0.15" />
      <polyline points={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  )
}

export function TradesKpis({ stats }: { stats: Stats }) {
  return (
    <div className="stagger grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      <KpiCard
        title="Cumulative net P&L"
        badge={stats.tradeCount}
        stacked
        hero
        aside={
          stats.cumulative.length > 0 && (
            <Sparkline
              values={stats.cumulative.map((point) => point.value)}
              positive={stats.netPnl >= 0}
            />
          )
        }
      >
        <p className={cn("text-xl font-semibold sm:text-2xl", pnlColor(stats.netPnl))}>
          {formatUsd(stats.netPnl)}
        </p>
      </KpiCard>
      <KpiCard
        title="Profit factor"
        aside={<Donut profit={stats.grossProfit} loss={stats.grossLoss} />}
      >
        <p className="text-xl font-semibold sm:text-2xl">{profitFactorLabel(stats)}</p>
      </KpiCard>
      <KpiCard
        title="Trade win %"
        aside={<SemiGauge wins={stats.wins} breakeven={stats.breakeven} losses={stats.losses} />}
      >
        <p className="text-xl font-semibold sm:text-2xl">{formatPercent(stats.winRate)}</p>
      </KpiCard>
      <AvgWinLossCard stats={stats} wide />
    </div>
  )
}
