import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export interface StatRow {
  label: string
  value: React.ReactNode
  /** Color class of the value, e.g. from `pnlColor`. */
  className?: string
}

/** Two-column list of label and value, one figure per line. */
export function StatTable({ title, rows }: { title: string; rows: StatRow[] }) {
  return (
    <Card className="gap-0 py-0">
      <p className="border-b px-4 py-3 text-sm font-medium">{title}</p>
      <dl>
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between gap-4 border-b px-4 py-3 text-sm last:border-b-0"
          >
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className={cn("font-medium tabular-nums", row.className)}>{row.value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}
