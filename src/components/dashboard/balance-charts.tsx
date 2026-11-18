"use client"

import { useId } from "react"
import { Area, AreaChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import type { BalancePoint } from "@/lib/accounts/balance-series"
import { formatCompactUsd, formatDay, formatUsd } from "@/lib/format"
import { niceTicks } from "@/lib/trading/ticks"
import { noChartAnimation } from "@/lib/use-reduced-motion"

const axisProps = { tickLine: false, axisLine: false, tickMargin: 8, fontSize: 11 } as const
const config = { balance: { label: "Balance", color: "var(--series-1)" } } satisfies ChartConfig

/** Balance over the trading days (one account, or the sum of several), drawn from the initial balance. */
export function BalanceChart({
  points,
  initialBalance,
}: {
  points: BalancePoint[]
  initialBalance: number
}) {
  const id = useId().replace(/:/g, "")
  if (points.length === 0)
    return <p className="py-16 text-center text-sm text-muted-foreground">No data.</p>

  const values = [initialBalance, ...points.map((point) => point.balance)]
  const ticks = niceTicks(Math.min(...values), Math.max(...values))
  const first = points[0]
  const last = points[points.length - 1]
  const summary = `Balance: from ${formatDay(first.date)} to ${formatDay(last.date)}, from ${formatUsd(first.balance)} to ${formatUsd(last.balance)}.`

  return (
    <ChartContainer
      config={config}
      className="chart-reveal aspect-auto min-h-56 w-full flex-1"
      role="group"
      aria-label={summary}
    >
      <AreaChart data={points} margin={{ left: 0, right: 8, top: 4 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--series-1)" stopOpacity={0.3} />
            <stop offset="100%" stopColor="var(--series-1)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="date" tickFormatter={formatDay} minTickGap={32} {...axisProps} />
        <YAxis
          tickFormatter={(value: number) => formatCompactUsd(value)}
          width={52}
          ticks={ticks}
          domain={[ticks[0], ticks[ticks.length - 1]]}
          {...axisProps}
        />
        <ReferenceLine y={initialBalance} stroke="var(--border)" />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(label) => formatDay(String(label))}
              formatter={(value) => <span className="font-medium">{formatUsd(Number(value))}</span>}
            />
          }
        />
        <Area
          name="Balance"
          dataKey="balance"
          type="monotone"
          stroke="var(--series-1)"
          strokeWidth={2}
          fill={`url(#${id})`}
          baseValue={initialBalance}
          {...noChartAnimation}
        />
      </AreaChart>
    </ChartContainer>
  )
}
