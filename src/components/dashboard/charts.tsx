"use client"

import { useId } from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  Scatter,
  ScatterChart,
  XAxis,
  YAxis,
} from "recharts"
import { useChartWindow } from "@/components/chart-window"
import { InfoTip } from "@/components/info-tip"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { formatCompactUsd, formatDay, formatDayYear, formatUsd } from "@/lib/format"
import { niceTicks } from "@/lib/trading/ticks"
import { noChartAnimation } from "@/lib/use-reduced-motion"

export interface Point {
  date: string
  value: number
}

export interface TimePoint {
  /** Hour of the day as a decimal, e.g. 9.5 for 09:30. */
  hour: number
  pnl: number
}

export function ChartCard({
  title,
  info,
  className,
  children,
}: {
  title: string
  /** Explanation shown in a bubble next to the title. */
  info?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <Card className={className}>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-1 text-sm font-semibold text-foreground">
          {title}
          {info && <InfoTip label={`Info: ${title}`}>{info}</InfoTip>}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">{children}</CardContent>
    </Card>
  )
}

const config = {
  value: { label: "P&L", color: "var(--profit)" },
} satisfies ChartConfig

const axisProps = { tickLine: false, axisLine: false, tickMargin: 8, fontSize: 11 } as const
const moneyTick = (value: number) => formatCompactUsd(value)
const dayTooltip = (
  <ChartTooltipContent
    labelFormatter={(label) => formatDay(String(label))}
    formatter={(value) => <span className="font-medium">{formatUsd(Number(value))}</span>}
  />
)

/** Text summary announced by screen readers in place of the picture of the chart. */
function seriesSummary(label: string, data: Point[]) {
  const first = data[0]
  const last = data[data.length - 1]
  const values = data.map((point) => point.value)
  return `${label}: from ${formatDay(first.date)} to ${formatDay(last.date)}, from ${formatUsd(first.value)} to ${formatUsd(last.value)} (min ${formatUsd(Math.min(...values))}, max ${formatUsd(Math.max(...values))}).`
}

function Empty() {
  return <p className="py-16 text-center text-sm text-muted-foreground">No data.</p>
}

/** Filled line chart over trading days, used for cumulative P&L, account balance and drawdown. */
export function AreaSeries({
  data,
  color = "var(--profit)",
  baseline,
}: {
  data: Point[]
  color?: string
  /** Value the area is drawn down to, e.g. the initial balance; defaults to 0. */
  baseline?: number
}) {
  const id = useId().replace(/:/g, "")
  if (data.length === 0) return <Empty />
  const values = data.map((point) => point.value)
  const ticks = niceTicks(Math.min(baseline ?? 0, ...values), Math.max(baseline ?? 0, ...values))
  return (
    <ChartContainer
      config={config}
      className="chart-reveal aspect-auto min-h-56 w-full flex-1"
      role="group"
      aria-label={seriesSummary("Curve", data)}
    >
      <AreaChart data={data} margin={{ left: 0, right: 8, top: 4 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="date" tickFormatter={formatDay} minTickGap={32} {...axisProps} />
        <YAxis
          tickFormatter={moneyTick}
          width={52}
          ticks={ticks}
          domain={[ticks[0], ticks[ticks.length - 1]]}
          {...axisProps}
        />
        {baseline !== undefined && <ReferenceLine y={baseline} stroke="var(--border)" />}
        <ChartTooltip content={dayTooltip} />
        <Area
          dataKey="value"
          type="monotone"
          stroke={color}
          strokeWidth={2}
          fill={`url(#${id})`}
          baseValue={baseline ?? 0}
          {...noChartAnimation}
        />
      </AreaChart>
    </ChartContainer>
  )
}

/** Bars shown at once in the daily chart: a longer history is browsed 60 days at a time. */
export const DAY_WINDOW = 60

export function DailyPnlBars({ data: allDays }: { data: Point[] }) {
  const { start, end, bar } = useChartWindow({
    total: allDays.length,
    size: DAY_WINDOW,
    unit: "days",
    describe: (from, to) =>
      allDays.length === 0
        ? ""
        : `${formatDay(allDays[from].date)} – ${formatDayYear(allDays[to - 1].date)}`,
  })
  if (allDays.length === 0) return <Empty />
  const data = allDays.slice(start, end)
  // The scale covers the whole history, so it stays put when the window moves to other days.
  const allValues = allDays.map((point) => point.value)
  const ticks = niceTicks(Math.min(0, ...allValues), Math.max(0, ...allValues))
  return (
    <>
      {bar}
      <ChartContainer
        config={config}
        className="chart-reveal aspect-auto min-h-56 w-full flex-1"
        role="group"
        aria-label={`Bars by day: ${data.length} days, ${data.filter((p) => p.value > 0).length} winning, ${data.filter((p) => p.value < 0).length} losing, total ${formatUsd(data.reduce((sum, p) => sum + p.value, 0))}.`}
      >
        <BarChart data={data} margin={{ left: 0, right: 8, top: 4 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="date" tickFormatter={formatDay} minTickGap={32} {...axisProps} />
          <YAxis
            tickFormatter={moneyTick}
            width={52}
            ticks={ticks}
            domain={[ticks[0], ticks[ticks.length - 1]]}
            {...axisProps}
          />
          <ReferenceLine y={0} stroke="var(--border)" />
          <ChartTooltip content={dayTooltip} />
          <Bar dataKey="value" radius={2} {...noChartAnimation}>
            {data.map((point) => (
              <Cell key={point.date} fill={point.value >= 0 ? "var(--profit)" : "var(--loss)"} />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
    </>
  )
}

const hourLabel = (hour: number) =>
  `${String(Math.floor(hour)).padStart(2, "0")}:${String(Math.round((hour % 1) * 60)).padStart(2, "0")}`

/** `total` is the number of trades before sampling: when it is larger than `data`, the chart says so. */
export function TimePerformance({ data, total }: { data: TimePoint[]; total?: number }) {
  if (data.length === 0) return <Empty />
  return (
    <>
      <ChartContainer
        config={config}
        className="chart-reveal aspect-auto min-h-56 w-full flex-1"
        role="group"
        aria-label={`Performance by hour: ${data.length} points, total ${formatUsd(data.reduce((sum, p) => sum + p.pnl, 0))}.`}
      >
        <ScatterChart margin={{ left: 0, right: 8, top: 4, bottom: 14 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            type="number"
            dataKey="hour"
            name="Time"
            domain={["dataMin - 0.25", "dataMax + 0.25"]}
            tickFormatter={hourLabel}
            label={{
              value: "New York time (ET)",
              position: "insideBottom",
              offset: -12,
              fontSize: 11,
              fill: "var(--muted-foreground)",
            }}
            {...axisProps}
          />
          <YAxis
            type="number"
            dataKey="pnl"
            name="P&L"
            tickFormatter={moneyTick}
            width={52}
            {...axisProps}
          />
          <ReferenceLine y={0} stroke="var(--border)" />
          <ChartTooltip
            cursor={{ strokeDasharray: "3 3" }}
            content={
              <ChartTooltipContent
                hideLabel
                formatter={(value, name) => (
                  <span className="font-medium">
                    {name === "Time" ? `${hourLabel(Number(value))} ET` : formatUsd(Number(value))}
                  </span>
                )}
              />
            }
          />
          <Scatter data={data} {...noChartAnimation}>
            {data.map((point, index) => (
              <Cell key={index} fill={point.pnl >= 0 ? "var(--profit)" : "var(--loss)"} />
            ))}
          </Scatter>
        </ScatterChart>
      </ChartContainer>
      {total !== undefined && total > data.length && (
        <p className="mt-1 text-xs text-muted-foreground">
          Showing {data.length.toLocaleString("en-US")} of {total.toLocaleString("en-US")} trades,
          evenly spread.
        </p>
      )}
    </>
  )
}
