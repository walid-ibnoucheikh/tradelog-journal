"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { MONTH_PLACEHOLDER, monthKey } from "@/lib/month"
import { cn } from "@/lib/utils"

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/**
 * The month label of a calendar, as a button that opens a year + 12 months picker.
 * `hrefTemplate` is the page address built with `MONTH_PLACEHOLDER` as month
 * (a function cannot cross from a server page to this client component).
 */
export function MonthPicker({
  year,
  month,
  label,
  hrefTemplate,
  onSelect,
  className,
}: {
  year: number
  month: number
  label: string
  /** Page address with the month placeholder; used when `onSelect` is not given. */
  hrefTemplate?: string
  /** Calendar driven on the client: no navigation, the parent shows the month. */
  onSelect?: (year: number, month: number) => void
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [pickerYear, setPickerYear] = useState(year)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    document.addEventListener("pointerdown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  const toggle = () => {
    setPickerYear(year)
    setOpen((value) => !value)
  }

  return (
    <div ref={root} className={cn("relative", className)}>
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="rounded px-2 py-1 text-center font-medium capitalize hover:bg-muted"
      >
        {label}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Choose a month"
          className="absolute left-1/2 top-full z-30 mt-1 w-64 -translate-x-1/2 rounded-lg border bg-popover p-3 text-popover-foreground shadow-lg"
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setPickerYear((value) => value - 1)}
              aria-label="Previous year"
              className="inline-flex size-11 items-center justify-center rounded hover:bg-muted sm:size-8"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="font-medium">{pickerYear}</span>
            <button
              type="button"
              onClick={() => setPickerYear((value) => value + 1)}
              aria-label="Next year"
              className="inline-flex size-11 items-center justify-center rounded hover:bg-muted sm:size-8"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {MONTHS.map((name, index) => {
              const current = pickerYear === year && index + 1 === month
              const classes = cn(
                "inline-flex h-11 items-center justify-center rounded text-sm hover:bg-muted sm:h-9",
                current && "bg-primary text-primary-foreground hover:bg-primary/90"
              )
              if (onSelect) {
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => {
                      onSelect(pickerYear, index + 1)
                      setOpen(false)
                    }}
                    aria-current={current ? "date" : undefined}
                    className={classes}
                  >
                    {name}
                  </button>
                )
              }
              return (
                <Link
                  key={name}
                  href={(hrefTemplate ?? "").replace(
                    MONTH_PLACEHOLDER,
                    monthKey(pickerYear, index + 1)
                  )}
                  scroll={false}
                  onClick={() => setOpen(false)}
                  aria-current={current ? "date" : undefined}
                  className={classes}
                >
                  {name}
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
