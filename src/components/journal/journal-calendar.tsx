import { ChevronLeft, ChevronRight } from "lucide-react"
import Link from "next/link"
import { MonthPicker } from "@/components/month-picker"
import { Card } from "@/components/ui/card"
import type { CalendarWeek } from "@/lib/trading/stats"
import { cn } from "@/lib/utils"

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"]

/** Compact month grid: days with trades are tinted by result and jump to their card. */
export function JournalCalendar({
  weeks,
  year,
  month,
  previousHref,
  nextHref,
  monthHrefTemplate,
}: {
  weeks: CalendarWeek[]
  year: number
  month: number
  previousHref: string
  nextHref: string
  /** Page address with `MONTH_PLACEHOLDER` as month, for the month picker. */
  monthHrefTemplate: string
}) {
  const label = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  })

  return (
    <Card className="gap-3 p-4">
      <div className="flex items-center justify-between">
        <Link
          href={previousHref}
          scroll={false}
          aria-label="Previous month"
          className="inline-flex size-8 items-center justify-center rounded hover:bg-muted"
        >
          <ChevronLeft className="size-4" />
        </Link>
        <MonthPicker year={year} month={month} label={label} hrefTemplate={monthHrefTemplate} />
        <Link
          href={nextHref}
          scroll={false}
          aria-label="Next month"
          className="inline-flex size-8 items-center justify-center rounded hover:bg-muted"
        >
          <ChevronRight className="size-4" />
        </Link>
      </div>
      <div className="grid grid-cols-7 gap-1.5 text-center text-xs">
        {WEEKDAYS.map((weekday, index) => (
          <div key={index} className="py-1 text-muted-foreground">
            {weekday}
          </div>
        ))}
        {weeks.flatMap((week, weekIndex) =>
          week.days.map((cell, index) => {
            if (!cell) return <div key={`${weekIndex}-${index}`} />
            const stat = cell.stat
            const className = cn(
              "rounded py-1.5",
              !stat && "bg-muted/50 text-muted-foreground",
              stat && stat.netPnl > 0 && "bg-profit/20 font-medium text-profit-text",
              stat && stat.netPnl < 0 && "bg-loss/20 font-medium text-loss-text",
              stat && stat.netPnl === 0 && "bg-be/20 font-medium text-be-text"
            )
            const date = `${year}-${String(month).padStart(2, "0")}-${String(cell.day).padStart(2, "0")}`
            return stat ? (
              <a key={date} href={`#day-${date}`} className={cn(className, "hover:opacity-80")}>
                {cell.day}
              </a>
            ) : (
              <div key={date} className={className}>
                {cell.day}
              </div>
            )
          })
        )}
      </div>
    </Card>
  )
}
