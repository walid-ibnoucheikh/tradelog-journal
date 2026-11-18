"use client"

import { ChevronRight } from "lucide-react"
import { useEffect, useState, type ReactNode } from "react"
import { Card } from "@/components/ui/card"
import { formatLongDay, formatUsd, pnlColor } from "@/lib/format"
import type { DaySummary } from "@/lib/journal"
import { cn } from "@/lib/utils"
import { DayNoteDialog } from "./day-note-dialog"
import { DayStats } from "./day-stats"
import { TOGGLE_ALL_EVENT } from "./expand-controls"

export function DayCard({
  day,
  note,
  tradeList,
}: {
  day: DaySummary
  note: string | null
  /** The day's trades, rendered by the server page and shown in the day's window. */
  tradeList: ReactNode
}) {
  const [open, setOpen] = useState(true)

  useEffect(() => {
    const onToggleAll = (event: Event) => setOpen((event as CustomEvent<boolean>).detail)
    window.addEventListener(TOGGLE_ALL_EVENT, onToggleAll)
    return () => window.removeEventListener(TOGGLE_ALL_EVENT, onToggleAll)
  }, [])

  return (
    <Card id={`day-${day.date}`} className="scroll-mt-6 gap-0 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          aria-expanded={open}
          aria-label={open ? "Collapse the day" : "Expand the day"}
          onClick={() => setOpen(!open)}
          className="inline-flex size-8 items-center justify-center rounded-full border hover:bg-muted"
        >
          <ChevronRight className={cn("size-4 transition-transform", open && "rotate-90")} />
        </button>
        <h2 className="text-base font-semibold first-letter:uppercase">
          {formatLongDay(day.date)}
        </h2>
        <p className="text-sm text-muted-foreground">
          Net P&amp;L{" "}
          <span className={cn("font-semibold", pnlColor(day.netPnl))}>{formatUsd(day.netPnl)}</span>
        </p>
        <DayNoteDialog day={day} note={note} tradeList={tradeList} />
      </div>

      {/* The figures fold by sliding shut (the chart stays built): nothing is mounted or redrawn, so
          "Expand all" and "Collapse all" no longer make the page jump or zoom. */}
      <div
        aria-hidden={!open}
        inert={!open}
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="pt-4">
            <DayStats day={day} />
          </div>
        </div>
      </div>
    </Card>
  )
}
