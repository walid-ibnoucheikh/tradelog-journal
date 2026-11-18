import { Suspense } from "react"
import { PnlToggle } from "./pnl-toggle"

/** Title of a report page with the net / gross switch on the right. */
export function ReportHeader({ title }: { title: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-xl font-semibold">{title}</h2>
      <Suspense fallback={<div className="h-9" />}>
        <PnlToggle />
      </Suspense>
    </div>
  )
}
