"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { windowRange } from "@/lib/chart-window"

/**
 * Keeps a long series readable without grouping it: only the last `size` bars are drawn, arrows move the
 * window back and forth, and "All" draws everything. Below `size` bars it does nothing and `bar` is null.
 * `describe` writes the span of the window ("12 Sep – 25 Nov 2026"); `unit` names what a bar is ("days").
 */
export function useChartWindow({
  total,
  size,
  unit,
  describe,
}: {
  total: number
  size: number
  unit: string
  describe: (start: number, end: number) => string
}) {
  const [offset, setOffset] = useState(0)
  const [all, setAll] = useState(false)
  const view = windowRange(total, size, offset)
  const start = all ? 0 : view.start
  const end = all ? total : view.end

  const bar =
    total > size ? (
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          {!all && (
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label={`Older ${unit}`}
              disabled={!view.hasOlder}
              onClick={() => setOffset(view.offset + size)}
            >
              <ChevronLeft />
            </Button>
          )}
          <span aria-live="polite" className="tabular-nums">
            {describe(start, end)}
            {all && ` · ${end - start} ${unit}`}
          </span>
          {!all && (
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label={`Newer ${unit}`}
              disabled={!view.hasNewer}
              onClick={() => setOffset(view.offset - size)}
            >
              <ChevronRight />
            </Button>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setAll(!all)
            setOffset(0)
          }}
        >
          {all ? `Last ${size}` : `All ${total}`}
        </Button>
      </div>
    ) : null

  return { start, end, bar }
}
