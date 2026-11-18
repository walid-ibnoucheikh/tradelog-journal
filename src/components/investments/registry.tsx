import { Pagination } from "@/components/pagination"
import { Card } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { DeleteTransactionButton } from "@/app/(app)/investments/delete-button"
import { formatDay, formatUsd, pnlColor } from "@/lib/format"
import {
  TRANSACTION_TYPES,
  signedAmount,
  type TransactionType,
} from "@/lib/investments/investments"
import { cn } from "@/lib/utils"

const typeLabel = new Map<string, string>(TRANSACTION_TYPES.map((t) => [t.value, t.label]))

export interface RegistryRow {
  id: string
  day: string
  firm: string
  accountName: string | null
  type: TransactionType
  note: string | null
  amount: number
}

/** One page of the transaction registry, with its net and the shared page navigation. */
export function Registry({
  rows,
  total,
  net,
  page,
  pageCount,
  pageHref,
}: {
  rows: RegistryRow[]
  /** Number of transactions matching the filters, over every page. */
  total: number
  net: number
  page: number
  pageCount: number
  pageHref: (page: number) => string
}) {
  if (total === 0) {
    return (
      <p className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
        No transactions for this selection.
      </p>
    )
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {total} transaction{total > 1 ? "s" : ""} · net{" "}
        <span className={cn("font-medium", pnlColor(net))}>{formatUsd(net)}</span>
      </p>
      <Card className="p-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Firm / provider</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Note</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const signed = signedAmount(row)
              return (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap">
                    {formatDay(row.day)} {row.day.slice(0, 4)}
                  </TableCell>
                  <TableCell>{row.firm}</TableCell>
                  <TableCell>{row.accountName ?? "—"}</TableCell>
                  <TableCell>{typeLabel.get(row.type)}</TableCell>
                  <TableCell className="max-w-64 truncate text-muted-foreground">
                    {row.note ?? ""}
                  </TableCell>
                  <TableCell className={cn("text-right font-medium", pnlColor(signed))}>
                    {signed > 0 ? "+" : ""}
                    {formatUsd(signed)}
                  </TableCell>
                  <TableCell>
                    <DeleteTransactionButton id={row.id} />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </Card>
      <Pagination
        page={page}
        pageCount={pageCount}
        total={total}
        noun={total > 1 ? "transactions" : "transaction"}
        hrefFor={pageHref}
      />
    </div>
  )
}
