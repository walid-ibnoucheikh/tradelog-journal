import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

/** Placeholders shaped like the real pages, shown while a page streams in: same grids, same heights. */

function Cards({ count, className, height }: { count: number; className: string; height: string }) {
  return (
    <div className={cn("grid gap-4", className)}>
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className={cn("rounded-xl", height)} />
      ))}
    </div>
  )
}

/** The row of KPI cards (5 on the dashboard, 4 on the trades page, 8 on investments). */
export function KpiGridSkeleton({
  count = 5,
  className = "sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5",
}: {
  count?: number
  className?: string
}) {
  return <Cards count={count} className={className} height="h-24" />
}

/** A table card: a header band and a few rows. */
export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-2 rounded-xl border bg-card p-3">
      <Skeleton className="h-10" />
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-9 bg-muted/60" />
      ))}
    </div>
  )
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <KpiGridSkeleton />
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-72 rounded-xl lg:col-span-2" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  )
}

export function TradesSkeleton() {
  return (
    <div className="space-y-4">
      <KpiGridSkeleton count={4} className="sm:grid-cols-2 xl:grid-cols-4" />
      <TableSkeleton rows={10} />
    </div>
  )
}

export function JournalSkeleton() {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="space-y-4">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
      <Skeleton className="h-72 rounded-xl" />
    </div>
  )
}

export function InvestmentsSkeleton() {
  return (
    <div className="space-y-6">
      <KpiGridSkeleton count={8} className="sm:grid-cols-2 xl:grid-cols-4" />
      <Skeleton className="h-72 rounded-xl" />
      <TableSkeleton rows={6} />
    </div>
  )
}

/** Generic content block: a chart or panel on top of a table. */
export function ContentSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-56 rounded-xl" />
      <TableSkeleton rows={6} />
    </div>
  )
}
