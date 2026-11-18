import type { Stats } from "./stats"

export interface ScoreMetric {
  key: "winRate" | "profitFactor" | "avgWinLoss" | "recovery" | "drawdown" | "consistency"
  label: string
  /** The metric as a score from 0 to 100. */
  score: number
}

export interface TradingScore {
  /** Mean of the six metric scores, from 0 to 100. */
  total: number
  metrics: ScoreMetric[]
}

const clamp = (value: number) => Math.max(0, Math.min(100, value))
const round2 = (value: number) => Math.round(value * 100) / 100

/**
 * A single 0-100 score of a set of trades: the mean of six notes, each between a floor (0) and a benchmark
 * that earns 100. The benchmarks are rules of thumb, not a standard:
 * - Win %: 60 % of decided trades won = 100.
 * - Profit factor: 3 = 100.
 * - Average win / average loss: 2 = 100.
 * - Recovery factor (net profit / max drawdown): 3 = 100; no drawdown with a profit = 100.
 * - Max drawdown, relative to the gross profit: no drawdown = 100, a drawdown as large as the gross profit = 0.
 * - Consistency: 100 when no single day weighs on the result, 0 when one day is all of it (or when losing).
 * A ratio that cannot be computed because there is no loss scores 100 when there are gains, else 0.
 * Returns null without any trade.
 */
export function computeScore(stats: Stats): TradingScore | null {
  if (stats.tradeCount === 0) return null

  const winRate = stats.winRate === null ? 0 : clamp((stats.winRate / 60) * 100)
  const profitFactor =
    stats.profitFactor === null
      ? stats.grossProfit > 0
        ? 100
        : 0
      : clamp((stats.profitFactor / 3) * 100)
  const avgWinLoss =
    stats.avgWinLossRatio === null
      ? stats.avgWin > 0
        ? 100
        : 0
      : clamp((stats.avgWinLossRatio / 2) * 100)

  const drawdownSize = Math.abs(stats.maxDrawdown)
  const recovery =
    stats.netPnl <= 0
      ? 0
      : drawdownSize === 0
        ? 100
        : clamp((stats.netPnl / drawdownSize / 3) * 100)
  const drawdown = stats.grossProfit === 0 ? 0 : clamp(100 * (1 - drawdownSize / stats.grossProfit))

  const bestDay = Math.max(0, ...stats.days.map((day) => day.netPnl))
  const consistency = stats.netPnl <= 0 ? 0 : clamp(100 * (1 - bestDay / stats.netPnl))

  const metrics: ScoreMetric[] = [
    { key: "winRate", label: "Win %", score: round2(winRate) },
    { key: "profitFactor", label: "Profit factor", score: round2(profitFactor) },
    { key: "avgWinLoss", label: "Avg win / loss", score: round2(avgWinLoss) },
    { key: "recovery", label: "Recovery factor", score: round2(recovery) },
    { key: "drawdown", label: "Drawdown max", score: round2(drawdown) },
    { key: "consistency", label: "Consistency", score: round2(consistency) },
  ]
  return {
    total: round2(metrics.reduce((sum, metric) => sum + metric.score, 0) / metrics.length),
    metrics,
  }
}
