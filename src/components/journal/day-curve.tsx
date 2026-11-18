"use client"

import { useId } from "react"
import { Area, AreaChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { formatCompactUsd, formatUsd } from "@/lib/format"
import { niceTicks } from "@/lib/trading/ticks"
import { useChartAnimation } from "@/lib/use-reduced-motion"

/** Cumulative P&L of one day, trade by trade (index 0 is the start of the day). */
export function DayCurve({ curve }: { curve: number[] }) {
  const motion = useChartAnimation()
  const id = useId().replace(/:/g, "")
  const color = curve[curve.length - 1] >= 0 ? "var(--profit)" : "var(--loss)"
  const ticks = niceTicks(Math.min(0, ...curve), Math.max(0, ...curve))
  const data = curve.map((value, index) => ({ index, value }))

  return (
    <ChartContainer config={{ value: { label: "P&L", color } }} className="h-40 w-full">
      <AreaChart data={data} margin={{ left: 0, right: 4, top: 4, bottom: 0 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="index" hide />
        <YAxis
          tickFormatter={formatCompactUsd}
          width={48}
          tickLine={false}
          axisLine={false}
          fontSize={11}
          ticks={ticks}
          domain={[ticks[0], ticks[ticks.length - 1]]}
        />
        <ReferenceLine y={0} stroke="var(--border)" />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(_, items) =>
                items[0]?.payload.index === 0 ? "Start of day" : `Trade ${items[0]?.payload.index}`
              }
              formatter={(value) => <span className="font-medium">{formatUsd(Number(value))}</span>}
            />
          }
        />
        <Area
          dataKey="value"
          type="linear"
          stroke={color}
          strokeWidth={2}
          fill={`url(#${id})`}
          {...motion}
        />
      </AreaChart>
    </ChartContainer>
  )
}
