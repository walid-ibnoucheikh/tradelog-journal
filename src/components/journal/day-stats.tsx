import { formatPercent, formatUsd, pnlColor } from "@/lib/format"
import type { DaySummary } from "@/lib/journal"
import { cn } from "@/lib/utils"
import { DayCurve } from "./day-curve"

function Metric({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className="space-y-1 border-l pl-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("font-semibold", className)}>{children}</p>
    </div>
  )
}

function profitFactorLabel(day: DaySummary) {
  if (day.profitFactor !== null) return day.profitFactor.toFixed(2)
  return day.wins > 0 ? "∞" : "—"
}

/** Intraday curve and the day's figures, shared by the journal card and the note window. */
export function DayStats({ day }: { day: DaySummary }) {
  return (
    <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <DayCurve curve={day.curve} />
      <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-flow-col sm:grid-cols-4 sm:grid-rows-2">
        <Metric label="Trades">{day.trades}</Metric>
        <Metric label="Win rate">{formatPercent(day.winRate)}</Metric>
        <Metric label="Winners">{day.wins}</Metric>
        <Metric label="Losers">{day.losses}</Metric>
        <Metric label="Gross P&L" className={pnlColor(day.grossPnl)}>
          {formatUsd(day.grossPnl)}
        </Metric>
        <Metric label="Volume">{day.volume}</Metric>
        <Metric label="Commissions">{formatUsd(day.commissions)}</Metric>
        <Metric label="Profit factor">{profitFactorLabel(day)}</Metric>
      </div>
    </div>
  )
}
