"use client"

import { SortHead, useSort } from "@/components/sortable-head"
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table"
import { formatPercent, formatUsd, pnlColor } from "@/lib/format"
import type { FirmRow, InvestmentReport } from "@/lib/investments/investment-report"
import { sortRows } from "@/lib/sort"
import { cn } from "@/lib/utils"

type Column = "firm" | "accounts" | "funded" | "blown" | "cost" | "payouts" | "net" | "roi"

const value: Record<Column, (row: FirmRow) => string | number | null> = {
  firm: (row) => row.firm,
  accounts: (row) => row.accounts,
  funded: (row) => row.funded,
  blown: (row) => row.blown,
  cost: (row) => row.cost,
  payouts: (row) => row.payouts,
  net: (row) => row.net,
  roi: (row) => row.roi,
}

export function FirmsTable({ report }: { report: InvestmentReport }) {
  const { sort, toggle } = useSort<Column>({ key: "net", direction: "desc" })
  if (report.firmRows.length === 0) {
    return <p className="text-sm text-muted-foreground">No prop firms to show.</p>
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <SortHead label="Prop firm" column="firm" sort={sort} onSort={toggle} />
          <SortHead label="Accounts" column="accounts" sort={sort} onSort={toggle} align="right" />
          <SortHead label="Funded" column="funded" sort={sort} onSort={toggle} align="right" />
          <SortHead label="Blown" column="blown" sort={sort} onSort={toggle} align="right" />
          <SortHead label="Spent" column="cost" sort={sort} onSort={toggle} align="right" />
          <SortHead label="Payouts" column="payouts" sort={sort} onSort={toggle} align="right" />
          <SortHead label="Net" column="net" sort={sort} onSort={toggle} align="right" />
          <SortHead label="ROI" column="roi" sort={sort} onSort={toggle} align="right" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortRows(report.firmRows, value[sort.key], sort.direction).map((row) => {
          return (
            <TableRow key={row.firm}>
              <TableCell className="font-medium">{row.firm}</TableCell>
              <TableCell className="text-right">{row.accounts}</TableCell>
              <TableCell className="text-right">{row.funded}</TableCell>
              <TableCell className="text-right">{row.blown}</TableCell>
              <TableCell className="text-right">{formatUsd(row.cost)}</TableCell>
              <TableCell className="text-right">{formatUsd(row.payouts)}</TableCell>
              <TableCell className={cn("text-right font-medium", pnlColor(row.net))}>
                {formatUsd(row.net)}
              </TableCell>
              <TableCell className={cn("text-right", row.roi === null ? "" : pnlColor(row.roi))}>
                {formatPercent(row.roi)}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
