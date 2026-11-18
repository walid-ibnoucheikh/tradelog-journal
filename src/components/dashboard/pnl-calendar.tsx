"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { useState } from "react"
import { Card } from "@/components/ui/card"
import { MonthPicker } from "@/components/month-picker"
import { CalendarDay } from "./calendar-day"
import { formatCompactUsd, formatUsd, pnlColor } from "@/lib/format"
import { DAY_PLACEHOLDER, MONTH_PLACEHOLDER, monthKey, shiftMonth } from "@/lib/month"
import { monthCalendar, type CalendarWeek, type DayStat } from "@/lib/trading/stats"
import { cn } from "@/lib/utils"

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

/**
 * The month is held here, on the client: all the traded days are passed in (a few KB), so switching
 * month redraws only this card, with no request to the server and no replay of the page's animations.
 * The address is kept in step (`?month=`) so a reload or a shared link opens the same month.
 */
export function PnlCalendar({
  days,
  initialMonth,
  dayHrefTemplate,
}: {
  /** Every traded day of the selection. */
  days: DayStat[]
  initialMonth: { year: number; month: number }
  /** Journal address with `MONTH_PLACEHOLDER` and `DAY_PLACEHOLDER`, filled in for each traded day. */
  dayHrefTemplate: string
}) {
  const [shown, setShown] = useState(initialMonth)
  // The entrance fade of the cells only plays for the first month shown, not for each switch.
  const [switched, setSwitched] = useState(false)
  const { year, month } = shown

  const show = (next: { year: number; month: number }) => {
    setShown(next)
    setSwitched(true)
    const url = new URL(window.location.href)
    url.searchParams.set("month", monthKey(next.year, next.month))
    window.history.replaceState(window.history.state, "", url)
  }
  const shift = (delta: number) => {
    const [y, m] = shiftMonth(year, month, delta).split("-").map(Number)
    show({ year: y, month: m })
  }

  const weeks = monthCalendar(days, year, month)
  const key = monthKey(year, month)
  const monthDays = days.filter((day) => day.date.startsWith(key))
  const monthStats = {
    netPnl: monthDays.reduce((sum, day) => sum + day.netPnl, 0),
    tradingDays: monthDays.length,
  }
  const dayHref = (date: string) =>
    dayHrefTemplate.replace(DAY_PLACEHOLDER, date).replace(MONTH_PLACEHOLDER, date.slice(0, 7))

  const label = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  })

  return (
    <Card className="min-w-0 flex-1 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => shift(-1)}
            aria-label="Previous month"
            className="inline-flex size-11 items-center justify-center rounded hover:bg-muted sm:size-8"
          >
            <ChevronLeft className="size-4" />
          </button>
          <MonthPicker
            year={year}
            month={month}
            label={label}
            onSelect={(y, m) => show({ year: y, month: m })}
            className="min-w-36 text-center"
          />
          <button
            type="button"
            onClick={() => shift(1)}
            aria-label="Next month"
            className="inline-flex size-11 items-center justify-center rounded hover:bg-muted sm:size-8"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground">
          Month:{" "}
          <span className={cn("font-medium", pnlColor(monthStats.netPnl))}>
            {/* On a phone there is room for the exact amount; the grid below keeps short ones. */}
            <span className="sm:hidden">{formatUsd(monthStats.netPnl)}</span>
            <span className="hidden sm:inline">{formatCompactUsd(monthStats.netPnl)}</span>
          </span>
          <span className="ml-2 rounded bg-muted px-1.5 text-xs">{monthStats.tradingDays} d</span>
        </p>
      </div>

      {/* A phone shows the seven days across the screen, with each week's total on a line under it;
          from `sm` the total sits in a column on the right and the weeks share the card's height. */}
      <div className="flex flex-1">
        <div className="min-w-0 flex-1">
          <div
            className="grid h-full grid-cols-7 gap-0.5 sm:grid-cols-[repeat(7,minmax(0,1fr))_7rem] sm:gap-1.5 sm:[grid-template-rows:auto_repeat(var(--weeks),minmax(4.5rem,1fr))]"
            style={{ "--weeks": weeks.length } as React.CSSProperties}
          >
            {WEEKDAYS.map((weekday) => (
              <div
                key={weekday}
                className="rounded bg-muted py-1 text-center text-xs font-medium"
                aria-label={weekday}
              >
                <span className="sm:hidden">{weekday[0]}</span>
                <span className="hidden sm:inline">{weekday}</span>
              </div>
            ))}
            <div className="hidden sm:block" />
            {weeks.map((week, index) => (
              <WeekRow
                key={index}
                week={week}
                number={index + 1}
                dayHref={dayHref}
                animate={!switched}
              />
            ))}
          </div>
        </div>
      </div>
    </Card>
  )
}

function WeekRow({
  week,
  number,
  dayHref,
  animate,
}: {
  week: CalendarWeek
  number: number
  dayHref: (date: string) => string
  animate: boolean
}) {
  return (
    <>
      {week.days.map((cell, index) => {
        const stat = cell?.stat
        const position = (number - 1) * 7 + index
        if (cell && stat) {
          return (
            <CalendarDay
              key={index}
              day={cell.day}
              stat={stat}
              href={dayHref(stat.date)}
              index={position}
              animate={animate}
            />
          )
        }
        return (
          <div
            key={index}
            style={{ "--i": position } as React.CSSProperties}
            className={cn(
              animate && "cell-in",
              "flex min-h-12 flex-col justify-between rounded border p-0.5 text-right text-xs sm:p-1.5",
              !cell && "border-transparent bg-transparent",
              cell && "bg-muted/40 text-muted-foreground"
            )}
          >
            <span className="text-muted-foreground">{cell?.day}</span>
          </div>
        )
      })}
      <div className="col-span-7 mb-1 flex items-center justify-between rounded border px-2 py-1 text-xs sm:col-span-1 sm:mb-0 sm:flex-col sm:justify-center sm:p-2 sm:text-center">
        <span className="text-muted-foreground">Week {number}</span>
        <span className={cn("text-sm font-semibold", pnlColor(week.netPnl))}>
          <span className="sm:hidden">{formatUsd(week.netPnl)}</span>
          <span className="hidden sm:inline">{formatCompactUsd(week.netPnl)}</span>
        </span>
        <span className="rounded bg-muted px-1.5 text-xs">{week.tradingDays} d</span>
      </div>
    </>
  )
}
