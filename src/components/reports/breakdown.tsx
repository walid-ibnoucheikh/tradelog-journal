import { ChartCard } from "@/components/dashboard/charts"
import { Card } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Pagination } from "@/components/pagination"
import {
  formatDay,
  formatDayYear,
  formatLongDay,
  formatLongMonth,
  formatPercent,
  formatUsd,
  pnlColor,
} from "@/lib/format"
import { paginate } from "@/lib/pagination"
import type { GroupRow, PnlMode, View } from "@/lib/reports"
import { cn } from "@/lib/utils"
import { GroupBars } from "./group-bars"

export const VIEW_TITLES: Record<View, string> = {
  day: "By day",
  week: "By week",
  month: "By month",
  time: "By opening time",
  duration: "By trade duration",
  instrument: "By instrument",
}

const FIRST_COLUMN: Record<View, string> = {
  day: "Day",
  week: "Week of",
  month: "Month",
  time: "Time (ET)",
  duration: "Duration",
  instrument: "Instrument",
}

/** Text of a row label; periods are stored as dates and written out here. */
function rowLabel(view: View, row: GroupRow, long: boolean) {
  if (view === "day") return long ? formatLongDay(row.key) : formatDay(row.key)
  if (view === "week") return formatDay(row.key)
  if (view === "month") return formatLongMonth(row.key)
  return row.label
}

const profitFactor = (row: GroupRow) =>
  row.profitFactor !== null ? row.profitFactor.toFixed(2) : row.wins > 0 ? "∞" : "—"

/** Bars shown at once in the chart of a long list of days or weeks. */
const WINDOW: Partial<Record<View, { size: number; unit: string }>> = {
  day: { size: 60, unit: "days" },
  week: { size: 26, unit: "weeks" },
}

/** What a row is called in the plural, for "Page 1 of 4 · 92 days". */
const NOUN: Record<View, string> = {
  day: "days",
  week: "weeks",
  month: "months",
  time: "hours",
  duration: "groups",
  instrument: "instruments",
}

/**
 * A chart of the P&L of each group and the table of its figures. A long list of days, weeks or months is
 * cut into pages of 25 rows like the trades (`page`, `pageHref`); the chart browses days and weeks in windows.
 */
export function BreakdownReport({
  view,
  rows,
  mode,
  page,
  pageHref,
}: {
  view: View
  rows: GroupRow[]
  mode: PnlMode
  /** The requested page of the table (null = the first). */
  page: number | null
  pageHref: (page: number) => string
}) {
  const kind = mode === "gross" ? "gross" : "net"
  const isPeriod = view === "day" || view === "week" || view === "month"
  // Periods read best newest first in the table, while the chart runs left to right in time.
  const ordered = isPeriod ? [...rows].reverse() : rows
  const paged = paginate(
    ordered,
    isPeriod ? page : null,
    isPeriod ? undefined : ordered.length || 1
  )
  const tableRows = paged.visible
  const chartWindow = WINDOW[view]

  return (
    <div className="space-y-4">
      <ChartCard
        title={`${kind[0].toUpperCase()}${kind.slice(1)} P&L ${VIEW_TITLES[view].toLowerCase()}`}
      >
        <GroupBars
          windowSize={chartWindow?.size}
          unit={chartWindow?.unit}
          data={rows.map((row) => ({
            label: rowLabel(view, row, false),
            rangeLabel: view === "day" || view === "week" ? formatDayYear(row.key) : undefined,
            pnl: row.pnl,
            trades: row.trades,
            winRate: row.winRate,
          }))}
        />
      </ChartCard>
      <Card className="p-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{FIRST_COLUMN[view]}</TableHead>
              <TableHead className="text-right">Trades</TableHead>
              <TableHead className="text-right">Win %</TableHead>
              <TableHead className="text-right">
                {kind === "gross" ? "Gross" : "Net"} P&amp;L
              </TableHead>
              <TableHead className="text-right">Average P&amp;L</TableHead>
              <TableHead className="text-right">Profit factor</TableHead>
              <TableHead className="text-right">Contracts</TableHead>
              <TableHead className="text-right">Fees</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tableRows.map((row) => (
              <TableRow key={row.key}>
                <TableCell className="whitespace-nowrap font-medium first-letter:uppercase">
                  {rowLabel(view, row, true)}
                </TableCell>
                <TableCell className="text-right">{row.trades}</TableCell>
                <TableCell className="text-right">{formatPercent(row.winRate)}</TableCell>
                <TableCell className={cn("text-right font-medium", pnlColor(row.pnl))}>
                  {formatUsd(row.pnl)}
                </TableCell>
                <TableCell className={cn("text-right", pnlColor(row.avgPnl))}>
                  {formatUsd(row.avgPnl)}
                </TableCell>
                <TableCell className="text-right">{profitFactor(row)}</TableCell>
                <TableCell className="text-right">{row.volume}</TableCell>
                <TableCell className="text-right">{formatUsd(row.commissions)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <Pagination
        page={paged.page}
        pageCount={paged.pageCount}
        total={ordered.length}
        noun={NOUN[view]}
        hrefFor={pageHref}
      />
    </div>
  )
}
