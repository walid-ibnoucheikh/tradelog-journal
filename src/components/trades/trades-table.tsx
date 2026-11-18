import Link from "next/link"
import { Card } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { TradeRow } from "@/db/queries"
import {
  formatDateTime,
  formatDuration,
  formatPrice,
  formatTime,
  formatUsd,
  pnlColor,
} from "@/lib/format"
import { cn } from "@/lib/utils"
import { StatusBadge } from "./status-badge"

/** The same trades as cards, for a phone: a nine-column table does not fit in 390 px. */
function TradeCards({
  trades,
  accountNames,
}: {
  trades: TradeRow[]
  accountNames: Map<string, string> | null
}) {
  return (
    <ul className="space-y-2 sm:hidden">
      {trades.map((trade) => (
        <li key={trade.id}>
          <Link
            href={`/trades/${trade.id}`}
            className="block rounded-xl border bg-card p-3 active:bg-muted/60"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium">
                  {trade.contract}
                  <span className="text-sm font-normal text-muted-foreground">
                    {trade.direction === "Long" ? "Long" : "Short"} × {trade.quantity}
                  </span>
                  <StatusBadge status={trade.status} source={trade.breakEvenSource} />
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDateTime(trade.openedAt)} ET
                  {accountNames && ` · ${accountNames.get(trade.accountId)}`}
                </p>
              </div>
              <p
                className={cn(
                  "shrink-0 text-base font-semibold tabular-nums",
                  pnlColor(trade.netPnl)
                )}
              >
                {formatUsd(trade.netPnl)}
              </p>
            </div>
            <p className="mt-2 text-xs tabular-nums text-muted-foreground">
              {formatPrice(trade.avgEntry)} → {formatPrice(trade.avgExit)} ·{" "}
              {formatDuration(trade.closedAt.getTime() - trade.openedAt.getTime())}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  )
}

export function TradesTable({
  trades,
  accountNames,
  compact = false,
}: {
  trades: TradeRow[]
  /** Account ID → name, set only when more than one account exists (adds a column). */
  accountNames: Map<string, string> | null
  /** For a list of one day inside a window: only the time (the date is known), no close column. */
  compact?: boolean
}) {
  return (
    <>
      <TradeCards trades={trades} accountNames={accountNames} />
      <Card className={cn("hidden p-2 sm:block", compact && "rounded-lg p-1 shadow-none")}>
        <Table className="[&_td]:px-1.5 [&_th]:px-1.5">
          <TableHeader>
            <TableRow>
              <TableHead>{compact ? "Time (ET)" : "Open (ET)"}</TableHead>
              {accountNames && <TableHead>Account</TableHead>}
              <TableHead>Symbol</TableHead>
              <TableHead>Side</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead>Status</TableHead>
              {!compact && <TableHead>Close (ET)</TableHead>}
              <TableHead className="text-right">Entry</TableHead>
              <TableHead className="text-right">Exit</TableHead>
              <TableHead className="text-right">Duration</TableHead>
              <TableHead className="text-right">Net P&amp;L</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {trades.map((trade) => (
              <TableRow key={trade.id}>
                <TableCell className="whitespace-nowrap">
                  {compact ? formatTime(trade.openedAt) : formatDateTime(trade.openedAt)}
                </TableCell>
                {accountNames && <TableCell>{accountNames.get(trade.accountId)}</TableCell>}
                <TableCell className="font-medium">
                  <Link href={`/trades/${trade.id}`} className="hover:underline">
                    {trade.contract}
                  </Link>
                </TableCell>
                <TableCell>{trade.direction === "Long" ? "Long" : "Short"}</TableCell>
                <TableCell className="text-right">{trade.quantity}</TableCell>
                <TableCell>
                  <StatusBadge status={trade.status} source={trade.breakEvenSource} />
                </TableCell>
                {!compact && (
                  <TableCell className="whitespace-nowrap">
                    {formatDateTime(trade.closedAt)}
                  </TableCell>
                )}
                <TableCell className="text-right">{formatPrice(trade.avgEntry)}</TableCell>
                <TableCell className="text-right">{formatPrice(trade.avgExit)}</TableCell>
                <TableCell className="whitespace-nowrap text-right">
                  {formatDuration(trade.closedAt.getTime() - trade.openedAt.getTime())}
                </TableCell>
                <TableCell className={cn("text-right font-medium", pnlColor(trade.netPnl))}>
                  {formatUsd(trade.netPnl)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  )
}
