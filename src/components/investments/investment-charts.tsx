"use client"

import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, XAxis, YAxis } from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { formatCompactUsd, formatMonth, formatUsd } from "@/lib/format"
import { niceTicks } from "@/lib/trading/ticks"
import { useChartAnimation } from "@/lib/use-reduced-motion"

const axisProps = { tickLine: false, axisLine: false, tickMargin: 8, fontSize: 11 } as const

const cashConfig = {
  spent: { label: "Spent", color: "var(--loss)" },
  payouts: { label: "Payouts", color: "var(--profit)" },
} satisfies ChartConfig

/** Costs (red) and payouts (green) side by side for each month. */
export function MonthlyCashChart({
  data,
}: {
  data: { month: string; spent: number; payouts: number }[]
}) {
  const motion = useChartAnimation()
  const ticks = niceTicks(0, Math.max(...data.map((row) => Math.max(row.spent, row.payouts))))
  return (
    <ChartContainer config={cashConfig} className="h-56 w-full">
      <BarChart data={data} margin={{ left: 0, right: 8, top: 4 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="month" tickFormatter={formatMonth} {...axisProps} />
        <YAxis
          tickFormatter={formatCompactUsd}
          width={52}
          ticks={ticks}
          domain={[ticks[0], ticks[ticks.length - 1]]}
          {...axisProps}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(label) => formatMonth(String(label))}
              formatter={(value, name) => (
                <span className="font-medium">
                  {cashConfig[name as keyof typeof cashConfig].label} {formatUsd(Number(value))}
                </span>
              )}
            />
          }
        />
        <Bar dataKey="spent" fill="var(--loss)" radius={2} {...motion} />
        <Bar dataKey="payouts" fill="var(--profit)" radius={2} {...motion} />
      </BarChart>
    </ChartContainer>
  )
}

const roiConfig = { roi: { label: "ROI", color: "var(--profit)" } } satisfies ChartConfig

/** Return on investment of each prop firm, green above zero and red below. */
export function FirmRoiChart({ data }: { data: { firm: string; roi: number }[] }) {
  const motion = useChartAnimation()
  const ticks = niceTicks(
    Math.min(0, ...data.map((row) => row.roi)),
    Math.max(0, ...data.map((row) => row.roi))
  )
  return (
    <ChartContainer config={roiConfig} className="h-56 w-full">
      <BarChart data={data} margin={{ left: 0, right: 8, top: 4 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="firm" {...axisProps} />
        <YAxis
          tickFormatter={(value) => `${value}%`}
          width={52}
          ticks={ticks}
          domain={[ticks[0], ticks[ticks.length - 1]]}
          {...axisProps}
        />
        <ReferenceLine y={0} stroke="var(--border)" />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => (
                <span className="font-medium">ROI {Number(value).toFixed(2)}%</span>
              )}
            />
          }
        />
        <Bar dataKey="roi" radius={2} {...motion}>
          {data.map((row) => (
            <Cell key={row.firm} fill={row.roi >= 0 ? "var(--profit)" : "var(--loss)"} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}
