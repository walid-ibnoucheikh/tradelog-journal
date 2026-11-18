import { ArrowLeft, ChevronRight } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { StatusBadge } from "@/components/trades/status-badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getTrade } from "@/db/queries"
import { formatDateTime, formatDuration, formatPrice, formatUsd, pnlColor } from "@/lib/format"
import {
  BREAKEVEN_MAX_POINTS,
  BREAKEVEN_MIN_POINTS,
  describeTrade,
  pointsPerContract,
  tradePoints,
} from "@/lib/trading/trade"
import { cn } from "@/lib/utils"
import { BreakEvenControl } from "./break-even-control"
import { NoteForm } from "./note-form"

function Detail({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className="space-y-1">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className={cn("font-medium", className)}>{children}</dd>
    </div>
  )
}

async function TradeDetail({ params }: { params: PageProps<"/trades/[id]">["params"] }) {
  const { id } = await params
  const result = await getTrade(id)
  if (!result) notFound()
  const { trade, account, fills } = result
  const points = tradePoints(trade)
  const { status, breakEvenSource } = describeTrade(trade)
  const pointsMoved = pointsPerContract(trade)

  return (
    <div className="space-y-4">
      <title>{`${trade.contract} · ${trade.direction} · Tradelog`}</title>
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">
          {trade.contract} · {trade.direction}
        </h1>
        <StatusBadge status={status} source={breakEvenSource} />
      </div>

      <Card>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
            <Detail label="Net P&L" className={cn("text-xl", pnlColor(trade.netPnl))}>
              {formatUsd(trade.netPnl)}
            </Detail>
            <Detail label="Gross P&L" className={pnlColor(trade.grossPnl)}>
              {formatUsd(trade.grossPnl)}
            </Detail>
            <Detail label="Commissions">{formatUsd(trade.commission)}</Detail>
            <Detail label="Points" className={pnlColor(points)}>
              {points > 0 ? "+" : ""}
              {points}
            </Detail>
            <Detail label="Quantity">{trade.quantity}</Detail>
            <Detail label="Average entry price">{formatPrice(trade.avgEntry)}</Detail>
            <Detail label="Average exit price">{formatPrice(trade.avgExit)}</Detail>
            <Detail label="Duration">
              {formatDuration(trade.closedAt.getTime() - trade.openedAt.getTime())}
            </Detail>
            <Detail label="Open (ET)">{formatDateTime(trade.openedAt, true)}</Detail>
            <Detail label="Close (ET)">{formatDateTime(trade.closedAt, true)}</Detail>
            <Detail label="Account">{account?.name ?? "—"}</Detail>
          </dl>
        </CardContent>
      </Card>

      {/* Break-even: folded by default (the rule decides, this is the rare correction); one line says where it stands. */}
      <Card className="py-0">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-6 py-4 [&::-webkit-details-marker]:hidden">
            <ChevronRight className="size-4 text-muted-foreground transition-transform group-open:rotate-90" />
            <span className="text-sm font-medium text-muted-foreground">Break-even</span>
            <span className="ml-auto text-sm">
              {trade.breakEvenOverride === null
                ? "Automatic"
                : trade.breakEvenOverride
                  ? "Marked as a BE"
                  : "Marked as not a BE"}
            </span>
          </summary>
          <div className="px-6 pb-5">
            <BreakEvenControl
              tradeId={trade.id}
              override={trade.breakEvenOverride}
              pointsMoved={pointsMoved}
              detected={pointsMoved >= BREAKEVEN_MIN_POINTS && pointsMoved <= BREAKEVEN_MAX_POINTS}
            />
          </div>
        </details>
      </Card>

      {/* Executions (folded), then the note, one under the other. */}
      <div className="space-y-4">
        {/* Folded by default, like the break-even: the figures above say what happened. */}
        <Card className="py-0">
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-6 py-4 [&::-webkit-details-marker]:hidden">
              <ChevronRight className="size-4 text-muted-foreground transition-transform group-open:rotate-90" />
              <span className="text-sm font-medium text-muted-foreground">Executions</span>
              <span className="ml-auto text-sm">
                {fills.length} {fills.length === 1 ? "fill" : "fills"}
              </span>
            </summary>
            <div className="px-6 pb-5">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time (ET)</TableHead>
                    <TableHead>Side</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Commission</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fills.map((fill) => (
                    <TableRow key={fill.id}>
                      <TableCell className="whitespace-nowrap">
                        {formatDateTime(fill.timestamp, true)}
                      </TableCell>
                      <TableCell>{fill.side === "Buy" ? "Buy" : "Sell"}</TableCell>
                      <TableCell className="text-right">{fill.quantity}</TableCell>
                      <TableCell className="text-right">{formatPrice(fill.price)}</TableCell>
                      <TableCell className="text-right">{formatUsd(fill.commission)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </details>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Note</CardTitle>
          </CardHeader>
          <CardContent>
            <NoteForm tradeId={trade.id} note={trade.note} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function TradePage(props: PageProps<"/trades/[id]">) {
  return (
    <>
      <Link
        href="/trades"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to trades
      </Link>
      <Suspense
        fallback={
          <>
            <title>Trade · Tradelog</title>
            <Skeleton className="h-96" />
          </>
        }
      >
        <TradeDetail params={props.params} />
      </Suspense>
    </>
  )
}
