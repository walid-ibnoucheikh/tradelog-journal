import type { BreakEvenSource, TradeStatus } from "@/lib/trading/trade"
import { cn } from "@/lib/utils"

const styles: Record<TradeStatus, { label: string; className: string }> = {
  win: { label: "WIN", className: "bg-profit/15 text-profit-text" },
  loss: { label: "LOSS", className: "bg-loss/15 text-loss-text" },
  be: { label: "BE", className: "bg-be/15 text-be-text" },
}

export function StatusBadge({
  status,
  source = null,
}: {
  status: TradeStatus
  /** "auto" marks a break-even found by the rule that Walid has not confirmed. */
  source?: BreakEvenSource | null
}) {
  const { label, className } = styles[status]
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("rounded px-2 py-0.5 text-xs font-semibold", className)}>{label}</span>
      {source === "auto" && (
        <span
          className="text-xs text-muted-foreground"
          title="Break-even detected by the rule: open the trade to confirm or correct it"
        >
          auto
        </span>
      )}
    </span>
  )
}
