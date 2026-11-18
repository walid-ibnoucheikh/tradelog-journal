"use client"

import Link from "next/link"
import {
  formatCompactUsd,
  formatLongDay,
  formatPhoneAmount,
  formatUsd,
  pnlColor,
} from "@/lib/format"
import type { DayStat } from "@/lib/trading/stats"
import { cn } from "@/lib/utils"

/**
 * A traded day of the dashboard calendar: it lifts on hover and a click opens that day in the Daily
 * Journal. The figures of the day are in the accessible name, for screen readers.
 */
export function CalendarDay({
  day,
  stat,
  href,
  index,
  animate = true,
}: {
  day: number
  stat: DayStat
  href: string
  /** Position in the grid, to stagger the entrance animation. */
  index: number
  /** False when the month is switched: the cells just change, without the entrance fade. */
  animate?: boolean
}) {
  const phone = formatPhoneAmount(stat.netPnl)
  const trades = `${stat.trades} trade${stat.trades > 1 ? "s" : ""}`
  const winRate = stat.winRate === null ? "" : `, ${stat.winRate.toFixed(0)}% winners`

  return (
    <Link
      href={href}
      aria-label={`${formatLongDay(stat.date)} : ${trades}, ${formatUsd(stat.netPnl)}${winRate}`}
      style={{ "--i": index } as React.CSSProperties}
      className={cn(
        animate && "cell-in",
        "relative flex min-h-12 flex-col justify-between rounded border p-0.5 text-right text-xs transition-[transform,box-shadow] duration-150 sm:p-1.5 hover:z-10 hover:scale-105 hover:shadow-md focus-visible:z-10 focus-visible:scale-105",
        stat.netPnl > 0 && "border-profit/30 bg-profit/10",
        stat.netPnl < 0 && "border-loss/30 bg-loss/10"
      )}
    >
      <span className="text-muted-foreground">{day}</span>
      <div className="space-y-0.5 text-center">
        <p
          className={cn(
            "text-[0.65rem] font-semibold tracking-tight whitespace-nowrap sm:text-sm sm:tracking-normal",
            // Longer amounts ("-$1.3k") get a smaller size so they stay inside a 40 px cell on a phone.
            phone.length >= 6
              ? "max-sm:text-[0.5625rem]"
              : phone.length === 5 && "max-sm:text-[0.6rem]",
            pnlColor(stat.netPnl)
          )}
        >
          <span className="sm:hidden">{phone}</span>
          <span className="hidden sm:inline">{formatCompactUsd(stat.netPnl)}</span>
        </p>
        <p className="hidden text-xs text-muted-foreground sm:block">{trades}</p>
      </div>
    </Link>
  )
}
