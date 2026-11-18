"use client"

import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, XAxis, YAxis } from "recharts"
import { useChartWindow } from "@/components/chart-window"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { formatCompactUsd, formatPercent, formatUsd } from "@/lib/format"
import { niceTicks } from "@/lib/trading/ticks"
import { useChartAnimation } from "@/lib/use-reduced-motion"

export interface Bucket {
  label: string
  /** Longer text for the span of a window ('15 Oct 2026'); the label when missing. */
  rangeLabel?: string
  pnl: number
  trades: number
  winRate: number | null
}

const config = { pnl: { label: "P&L", color: "var(--profit)" } } satisfies ChartConfig

/**
 * P&L of each group (period, hour, duration, instrument) as green and red bars. With `windowSize`, a longer
 * series is browsed that many bars at a time (see useChartWindow).
 */
export function GroupBars({
  data: allData,
  windowSize,
  unit = "bars",
}: {
  data: Bucket[]
  windowSize?: number
  unit?: string
}) {
  const motion = useChartAnimation()
  const { start, end, bar } = useChartWindow({
    total: allData.length,
    size: windowSize ?? Number.POSITIVE_INFINITY,
    unit,
    describe: (from, to) =>
      allData.length === 0
        ? ""
        : `${allData[from].rangeLabel ?? allData[from].label} – ${allData[to - 1].rangeLabel ?? allData[to - 1].label}`,
  })
  const data = allData.slice(start, end)
  // The scale covers every bar, so it stays put when the window moves to other bars.
  const allValues = allData.map((bucket) => bucket.pnl)
  const ticks = niceTicks(Math.min(0, ...allValues), Math.max(0, ...allValues))
  return (
    <>
      {bar}
      <ChartContainer config={config} className="h-64 w-full">
        <BarChart data={data} margin={{ left: 0, right: 8, top: 4 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            fontSize={11}
            minTickGap={16}
          />
          <YAxis
            tickFormatter={formatCompactUsd}
            width={52}
            ticks={ticks}
            domain={[ticks[0], ticks[ticks.length - 1]]}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            fontSize={11}
          />
          <ReferenceLine y={0} stroke="var(--border)" />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value, _name, item) => {
                  const bucket = item.payload as Bucket
                  return (
                    <div className="grid gap-0.5">
                      <span className="font-medium">{formatUsd(Number(value))}</span>
                      <span className="text-muted-foreground">
                        {bucket.trades} trade{bucket.trades > 1 ? "s" : ""} ·{" "}
                        {formatPercent(bucket.winRate)}
                      </span>
                    </div>
                  )
                }}
              />
            }
          />
          <Bar dataKey="pnl" radius={2} {...motion}>
            {data.map((bucket) => (
              <Cell key={bucket.label} fill={bucket.pnl >= 0 ? "var(--profit)" : "var(--loss)"} />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
    </>
  )
}
