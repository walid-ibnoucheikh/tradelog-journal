"use client"

import { AccountStatusBadge } from "@/components/account-status-badge"
import { SortHead, useSort } from "@/components/sortable-head"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDay, formatUsd, pnlColor } from "@/lib/format"
import type { AccountRow, InvestmentReport } from "@/lib/investments/investment-report"
import { sortRows } from "@/lib/sort"
import { cn } from "@/lib/utils"

type Column = "name" | "firm" | "status" | "openedOn" | "cost" | "payouts" | "net" | "tradingPnl"

const value: Record<Column, (row: AccountRow) => string | number> = {
  name: (row) => row.name,
  firm: (row) => row.firm,
  status: (row) => row.status,
  openedOn: (row) => row.openedOn,
  cost: (row) => row.cost,
  payouts: (row) => row.payouts,
  net: (row) => row.net,
  tradingPnl: (row) => row.tradingPnl,
}

function day(date: string) {
  return `${formatDay(date)} ${date.slice(0, 4)}`
}

export function AccountsTable({ report }: { report: InvestmentReport }) {
  const { sort, toggle } = useSort<Column>({ key: "openedOn", direction: "desc" })
  if (report.accountRows.length === 0 && !report.unlinked) {
    return <p className="text-sm text-muted-foreground">No accounts to show.</p>
  }
  return (
    <Table className="[&_td]:px-1.5 [&_th]:px-1.5">
      <TableHeader>
        <TableRow>
          <SortHead label="Account" column="name" sort={sort} onSort={toggle} />
          <SortHead label="Prop firm" column="firm" sort={sort} onSort={toggle} />
          <SortHead label="Status" column="status" sort={sort} onSort={toggle} />
          <SortHead label="Opened on" column="openedOn" sort={sort} onSort={toggle} />
          <TableHead>Funded / end</TableHead>
          <SortHead label="Spent" column="cost" sort={sort} onSort={toggle} align="right" />
          <SortHead label="Payouts" column="payouts" sort={sort} onSort={toggle} align="right" />
          <SortHead label="Net" column="net" sort={sort} onSort={toggle} align="right" />
          <SortHead
            label="P&L trading"
            column="tradingPnl"
            sort={sort}
            onSort={toggle}
            align="right"
          />
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortRows(report.accountRows, value[sort.key], sort.direction).map((row) => (
          <TableRow key={row.id}>
            <TableCell className="font-medium">{row.name}</TableCell>
            <TableCell>{row.firm}</TableCell>
            <TableCell>
              <AccountStatusBadge status={row.status} />
            </TableCell>
            <TableCell className="whitespace-nowrap">{day(row.openedOn)}</TableCell>
            <TableCell className="whitespace-nowrap text-muted-foreground">
              {row.fundedAt && <div>Funded {day(row.fundedAt)}</div>}
              {row.endedAt && <div>End {day(row.endedAt)}</div>}
              {!row.fundedAt && !row.endedAt && "—"}
            </TableCell>
            <TableCell className="text-right">{formatUsd(row.cost)}</TableCell>
            <TableCell className="text-right">{formatUsd(row.payouts)}</TableCell>
            <TableCell className={cn("text-right font-medium", pnlColor(row.net))}>
              {formatUsd(row.net)}
            </TableCell>
            <TableCell className={cn("text-right", pnlColor(row.tradingPnl))}>
              {formatUsd(row.tradingPnl)}
            </TableCell>
          </TableRow>
        ))}
        {report.unlinked && (
          <TableRow>
            <TableCell className="italic text-muted-foreground" colSpan={5}>
              Transactions without an account
            </TableCell>
            <TableCell className="text-right">{formatUsd(report.unlinked.cost)}</TableCell>
            <TableCell className="text-right">{formatUsd(report.unlinked.payouts)}</TableCell>
            <TableCell className={cn("text-right font-medium", pnlColor(report.unlinked.net))}>
              {formatUsd(report.unlinked.net)}
            </TableCell>
            <TableCell />
          </TableRow>
        )}
      </TableBody>
    </Table>
  )
}
