"use client"

import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart } from "recharts"
import { InfoTip } from "@/components/info-tip"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import type { TradingScore } from "@/lib/trading/score"
import { useChartAnimation } from "@/lib/use-reduced-motion"

const config = { score: { label: "Score", color: "var(--primary)" } } satisfies ChartConfig

/** Radar of the six notes and the overall score on a red-to-green scale, as a score card. */
export function ScoreCard({ score }: { score: TradingScore | null }) {
  const motion = useChartAnimation()

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-1 text-sm font-semibold text-foreground">
          Score
          <InfoTip label="How the score is calculated">
            <p>Average of six scores out of 100, each capped at its benchmark:</p>
            <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
              <li>Win %: 60% = 100</li>
              <li>Profit factor: 3 = 100</li>
              <li>Avg win / avg loss: 2 = 100</li>
              <li>Recovery factor (net profit ÷ max drawdown): 3 = 100</li>
              <li>Max drawdown, relative to gross profit: none = 100</li>
              <li>Consistency: no single day drives the result = 100</li>
            </ul>
          </InfoTip>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        {score === null ? (
          <p className="py-16 text-center text-sm text-muted-foreground">No data.</p>
        ) : (
          <>
            <ChartContainer
              config={config}
              className="aspect-auto min-h-56 w-full flex-1"
              role="group"
              aria-label={`Score ${score.total.toFixed(0)} out of 100: ${score.metrics
                .map((metric) => `${metric.label} ${metric.score.toFixed(0)}`)
                .join(", ")}.`}
            >
              <RadarChart data={score.metrics} outerRadius="60%" margin={{ left: 24, right: 24 }}>
                <PolarGrid />
                <PolarAngleAxis dataKey="label" tick={{ fontSize: 11 }} />
                <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      hideLabel
                      formatter={(value, _name, item) => (
                        <span className="flex items-center gap-2">
                          <span className="text-muted-foreground">{item.payload.label}</span>
                          <span className="font-medium">{Number(value).toFixed(0)} / 100</span>
                        </span>
                      )}
                    />
                  }
                />
                <Radar
                  name="Score"
                  dataKey="score"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  fill="var(--primary)"
                  fillOpacity={0.25}
                  {...motion}
                />
              </RadarChart>
            </ChartContainer>
            <div className="flex items-center gap-4 border-t pt-4">
              <div>
                <p className="text-xs text-muted-foreground">Your score</p>
                <p className="text-2xl font-semibold">{score.total.toFixed(2)}</p>
              </div>
              <div className="min-w-0 flex-1">
                <div className="relative h-2 rounded-full bg-gradient-to-r from-loss via-yellow-400 to-profit">
                  <span
                    aria-hidden
                    className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-foreground shadow"
                    style={{ left: `${score.total}%` }}
                  />
                </div>
                <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                  <span>0</span>
                  <span>50</span>
                  <span>100</span>
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
