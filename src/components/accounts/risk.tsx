import { TriangleAlert } from "lucide-react"
import { DANGER_MARGIN, WATCH_MARGIN, type RiskLevel } from "@/lib/accounts/account-views"
import { cn } from "@/lib/utils"

/** Bar colour for a margin left: green with room, yellow when it gets tight, red when nearly gone. */
export const marginTone = (percentRemaining: number) =>
  percentRemaining > WATCH_MARGIN
    ? "bg-profit"
    : percentRemaining > DANGER_MARGIN
      ? "bg-yellow-500"
      : "bg-loss"

/** Same scale for a daily allowance being used up. */
export const usedTone = (percentUsed: number) => marginTone(100 - percentUsed)

export function Meter({
  percent,
  className,
  label,
}: {
  percent: number
  className: string
  label: string
}) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
      className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
    >
      <div className={cn("h-full rounded-full", className)} style={{ width: `${percent}%` }} />
    </div>
  )
}

const risks: Partial<Record<RiskLevel, { label: string; className: string }>> = {
  breached: { label: "Limit reached", className: "text-loss-text" },
  danger: { label: "Account in danger", className: "text-loss-text" },
  watch: { label: "Watch", className: "text-yellow-600 dark:text-yellow-400" },
}

/** A warning sign for accounts that need attention; nothing for the others. */
export function RiskIcon({ risk }: { risk: RiskLevel }) {
  const info = risks[risk]
  if (!info) return <span className="size-4 shrink-0" />
  return (
    <span title={info.label} className={cn("shrink-0", info.className)}>
      <TriangleAlert className="size-4" />
      <span className="sr-only">{info.label}</span>
    </span>
  )
}
