import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Trade } from "@/db/queries"
import { formatDay, formatUsd, pnlColor } from "@/lib/format"
import { dayKey } from "@/lib/trading/stats"
import { cn } from "@/lib/utils"

export function RecentTrades({ trades, className }: { trades: Trade[]; className?: string }) {
  const recent = [...trades].reverse().slice(0, 8)
  return (
    <Card className={className}>
      <CardHeader className="border-b">
        <CardTitle className="text-sm font-semibold text-foreground">Recent trades</CardTitle>
      </CardHeader>
      <CardContent>
        {recent.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">No data.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Close date</TableHead>
                <TableHead>Symbol</TableHead>
                <TableHead className="text-right">Net P&amp;L</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recent.map((trade) => (
                <TableRow key={trade.id}>
                  <TableCell>{formatDay(dayKey(trade.closedAt))}</TableCell>
                  <TableCell>{trade.contract}</TableCell>
                  <TableCell className={cn("text-right font-medium", pnlColor(trade.netPnl))}>
                    {formatUsd(trade.netPnl)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
