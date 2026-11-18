"use client"

import { useId, useState } from "react"
import { formatCompactUsd, formatUsd } from "@/lib/format"
import { cn } from "@/lib/utils"

const BAR_WIDTH = 96
const BAR_HEIGHT = 8

/** Small floating label shown above a gauge while one of its parts is hovered. */
function Tip({ children }: { children: React.ReactNode }) {
  return (
    <span
      role="presentation"
      className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1.5 -translate-x-1/2 rounded-md border bg-popover px-2 py-1 text-xs font-medium whitespace-nowrap text-popover-foreground shadow-md"
    >
      {children}
    </span>
  )
}

const share = (part: number, total: number) => `${((part / total) * 100).toFixed(1)}%`

// Gauge geometry in screen pixels (viewBox = rendered size, so nothing is scaled and every stroke is a
// whole number of pixels: that is what keeps the arcs sharp on any screen).
const GAUGE_WIDTH = 80
const GAUGE_HEIGHT = 44
const GAUGE_RADIUS = 32
const GAUGE_STROKE = 8
const GAUGE_STROKE_HOVER = 10
const GAUGE_CENTER_X = GAUGE_WIDTH / 2
const GAUGE_CENTER_Y = 40
/** Empty space kept between two segments, on top of their round end caps. */
const GAUGE_SPACER = 2

/** Point on the gauge circle; the angle is in degrees, 180 = left, 0 = right. */
function polar(angle: number) {
  const radians = (angle * Math.PI) / 180
  const x = GAUGE_CENTER_X + GAUGE_RADIUS * Math.cos(radians)
  const y = GAUGE_CENTER_Y - GAUGE_RADIUS * Math.sin(radians)
  return `${x.toFixed(2)} ${y.toFixed(2)}`
}

function arc(from: number, to: number) {
  return `M ${polar(from)} A ${GAUGE_RADIUS} ${GAUGE_RADIUS} 0 0 1 ${polar(to)}`
}

type Part = "win" | "be" | "loss"
/** Singular and plural wording of each part, for the hover label ("1 gagnant", "14 gagnants"). */
export type GaugeLabels = Record<Part, [string, string]>

const TRADE_LABELS: GaugeLabels = {
  win: ["winner", "winners"],
  be: ["break-even", "break-even"],
  loss: ["loser", "losers"],
}

const partStyle: Record<Part, { color: string; pill: string }> = {
  win: { color: "var(--profit)", pill: "bg-profit/15 text-profit-text" },
  be: { color: "var(--be)", pill: "bg-be/15 text-be-text" },
  loss: { color: "var(--loss)", pill: "bg-loss/15 text-loss-text" },
}

/**
 * Half-circle gauge split into win / break-even / loss segments, with the counts underneath.
 * Hovering a segment (or its count) thickens it, dims the others and names it in a small label.
 */
export function SemiGauge({
  wins,
  breakeven,
  losses,
  labels = TRADE_LABELS,
}: {
  wins: number
  breakeven: number
  losses: number
  labels?: GaugeLabels
}) {
  const [active, setActive] = useState<Part | null>(null)
  const total = wins + breakeven + losses
  const counts: Record<Part, number> = { win: wins, be: breakeven, loss: losses }
  const parts = (["win", "be", "loss"] as const).filter((part) => counts[part] > 0)
  // Round caps stick out by half the stroke on each side, so the angle between two segments must cover
  // both caps plus the spacer, or the segments would run into each other.
  const degreesPerPixel = 180 / (Math.PI * GAUGE_RADIUS)
  const gap = (GAUGE_STROKE + GAUGE_SPACER) * degreesPerPixel
  const available = 180 - gap * (parts.length - 1)

  let angle = 180
  const paths = parts.map((part, index) => {
    const sweep = Math.max((counts[part] / total) * available, 0.01)
    const path = { part, index, d: arc(angle, angle - sweep) }
    angle -= sweep + gap
    return path
  })

  const activeCount = active ? counts[active] : 0
  const word = (part: Part) => labels[part][counts[part] === 1 ? 0 : 1]

  return (
    <div
      className="relative flex shrink-0 flex-col items-center"
      onMouseLeave={() => setActive(null)}
    >
      {active && activeCount > 0 && (
        <Tip>
          {activeCount} {word(active)} · {share(activeCount, total)}
        </Tip>
      )}
      <svg
        viewBox={`0 0 ${GAUGE_WIDTH} ${GAUGE_HEIGHT}`}
        width={GAUGE_WIDTH}
        height={GAUGE_HEIGHT}
        aria-hidden
      >
        <path
          d={arc(180, 0)}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={GAUGE_STROKE}
          strokeLinecap="round"
        />
        {paths.map((path) => (
          <path
            key={path.part}
            className="gauge-segment cursor-default transition-[stroke-width,opacity] duration-150"
            style={
              {
                "--i": path.index,
                strokeWidth: active === path.part ? GAUGE_STROKE_HOVER : GAUGE_STROKE,
                opacity: active && active !== path.part ? 0.4 : 1,
              } as React.CSSProperties
            }
            pathLength={100}
            d={path.d}
            fill="none"
            stroke={partStyle[path.part].color}
            strokeLinecap="round"
            onMouseEnter={() => setActive(path.part)}
          />
        ))}
      </svg>
      <div className="mt-1 flex gap-1 text-xs font-medium">
        {(["win", "be", "loss"] as const).map((part) => (
          <span
            key={part}
            className={cn(
              "rounded-full px-1.5 transition-opacity duration-150",
              partStyle[part].pill,
              active && active !== part && "opacity-40"
            )}
            onMouseEnter={() => counts[part] > 0 && setActive(part)}
          >
            {counts[part]}
          </span>
        ))}
      </div>
    </div>
  )
}

/** Ring showing the share of gross profit versus gross loss. Drawn 1:1 (56 px) and rotated inside the SVG, not with CSS, to stay sharp. */
export function Donut({ profit, loss }: { profit: number; loss: number }) {
  const [active, setActive] = useState<"profit" | "loss" | null>(null)
  const total = profit + loss
  const radius = 22
  const profitShare = total > 0 ? (profit / total) * 100 : 0
  const lossShare = total > 0 ? (loss / total) * 100 : 0
  const stroke = (part: "profit" | "loss") => (active === part ? 9 : 7)
  const fade = (part: "profit" | "loss") => (active && active !== part ? 0.4 : 1)

  return (
    <div className="relative shrink-0" onMouseLeave={() => setActive(null)}>
      {active && total > 0 && (
        <Tip>
          {active === "profit" ? "Gross profit" : "Gross loss"}{" "}
          {formatUsd(active === "profit" ? profit : loss)} ·{" "}
          {share(active === "profit" ? profit : loss, total)}
        </Tip>
      )}
      <svg viewBox="0 0 56 56" width={56} height={56} aria-hidden>
        <g transform="rotate(-90 28 28)" fill="none">
          {total === 0 ? (
            <circle cx="28" cy="28" r={radius} stroke="var(--muted)" strokeWidth={7} />
          ) : (
            <>
              {/* Two separate arcs, one after the other: a full red ring under the green one would show
                  through it as soon as the green is dimmed. */}
              {loss > 0 && (
                <circle
                  className="ring-arc cursor-default transition-[stroke-width,opacity] duration-150"
                  style={{ strokeWidth: stroke("loss"), opacity: fade("loss") }}
                  cx="28"
                  cy="28"
                  r={radius}
                  pathLength={100}
                  stroke="var(--loss)"
                  strokeDasharray={`${lossShare} 100`}
                  strokeDashoffset={-profitShare}
                  onMouseEnter={() => setActive("loss")}
                />
              )}
              {profit > 0 && (
                <circle
                  className="ring-arc cursor-default transition-[stroke-width,opacity] duration-150"
                  style={{ strokeWidth: stroke("profit"), opacity: fade("profit") }}
                  cx="28"
                  cy="28"
                  r={radius}
                  pathLength={100}
                  stroke="var(--profit)"
                  strokeDasharray={`${profitShare} 100`}
                  onMouseEnter={() => setActive("profit")}
                />
              )}
            </>
          )}
        </g>
      </svg>
    </div>
  )
}

/**
 * Proportional green/red bar of the average win versus the average loss, amounts at both ends.
 * Hovering one side names it in a small label.
 */
export function AvgWinLossBar({ avgWin, avgLoss }: { avgWin: number; avgLoss: number }) {
  const [side, setSide] = useState<"win" | "loss" | null>(null)
  const total = avgWin + avgLoss
  const winShare = total > 0 ? (avgWin / total) * 100 : 0
  const clipId = useId().replace(/:/g, "")
  // The split lands on a whole pixel, so the two colors meet on a pixel edge.
  const split = Math.round((winShare / 100) * BAR_WIDTH)

  function track(event: React.MouseEvent<HTMLDivElement>) {
    const box = event.currentTarget.getBoundingClientRect()
    setSide(((event.clientX - box.left) / box.width) * 100 < winShare ? "win" : "loss")
  }

  return (
    <div
      className="relative flex w-24 shrink-0 flex-col gap-1"
      onMouseMove={total > 0 ? track : undefined}
      onMouseLeave={() => setSide(null)}
    >
      {side && (
        <Tip>
          {side === "win"
            ? `Average win ${formatUsd(avgWin)}`
            : `Average loss -${formatUsd(avgLoss)}`}
        </Tip>
      )}
      {/* Drawn 1:1 in pixels (96 x 8) with the colors split on a whole pixel: both colors are rectangles of
          the same height, so their edges line up exactly, and one rounded clip gives the two outer ends. */}
      <svg
        viewBox={`0 0 ${BAR_WIDTH} ${BAR_HEIGHT}`}
        width={BAR_WIDTH}
        height={BAR_HEIGHT}
        aria-hidden
        className={cn("transition-transform duration-150", side && "scale-y-150")}
      >
        <defs>
          <clipPath id={clipId}>
            <rect width={BAR_WIDTH} height={BAR_HEIGHT} rx={BAR_HEIGHT / 2} />
          </clipPath>
        </defs>
        <g clipPath={`url(#${clipId})`}>
          <rect width={BAR_WIDTH} height={BAR_HEIGHT} fill="var(--muted)" />
          {total > 0 && (
            <g className="bar-scale">
              <rect width={split} height={BAR_HEIGHT} fill="var(--profit)" />
              <rect x={split} width={BAR_WIDTH - split} height={BAR_HEIGHT} fill="var(--loss)" />
            </g>
          )}
        </g>
      </svg>
      <div className="flex justify-between text-xs font-medium">
        <span className="text-profit-text">{formatCompactUsd(avgWin)}</span>
        <span className="text-loss-text">-{formatCompactUsd(avgLoss)}</span>
      </div>
    </div>
  )
}
