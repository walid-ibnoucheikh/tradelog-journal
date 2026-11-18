"use client"

import { AccountStatusBadge } from "@/components/account-status-badge"
import { SortHead, useSort } from "@/components/sortable-head"
import { Card } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table"
import type { AccountView } from "@/lib/accounts/account-views"
import { groupAccountsByFirm } from "@/lib/accounts/groups"
import { formatDay, formatDayYear, formatUsd, pnlColor } from "@/lib/format"
import { sortRows } from "@/lib/sort"
import { cn } from "@/lib/utils"

type Column = "name" | "openedOn" | "endedAt" | "lifetime" | "balance" | "cost" | "net"

const value: Record<Column, (view: AccountView) => string | number | null> = {
  name: (view) => view.name,
  openedOn: (view) => view.openedOn,
  endedAt: (view) => view.endedAt,
  lifetime: (view) => view.lifetimeDays,
  balance: (view) => view.progress.balance,
  cost: (view) => view.money.cost,
  net: (view) => view.money.net,
}

/** Finished accounts: how each one ended, how long it lasted and what it cost, to learn from them. */
export function EndedAccountsTable({
  views,
  grouped,
  onOpen,
}: {
  views: AccountView[]
  grouped: boolean
  onOpen: (id: string) => void
}) {
  const { sort, toggle } = useSort<Column>({ key: "endedAt", direction: "desc" }, { name: "asc" })
  const sorted = sortRows(views, value[sort.key], sort.direction)
  const groups = grouped ? groupAccountsByFirm(sorted) : [{ firm: "", accounts: sorted }]

  return (
    <Card className="overflow-x-auto p-2">
      <Table>
        <TableHeader>
          <TableRow>
            <SortHead label="Account" column="name" sort={sort} onSort={toggle} />
            <SortHead
              label="Purchased on"
              column="openedOn"
              sort={sort}
              onSort={toggle}
              className="hidden sm:table-cell"
            />
            <SortHead label="Issue" column="endedAt" sort={sort} onSort={toggle} />
            <SortHead
              label="Lifetime"
              column="lifetime"
              sort={sort}
              onSort={toggle}
              align="right"
              className="hidden sm:table-cell"
            />
            <SortHead
              label="Final balance"
              column="balance"
              sort={sort}
              onSort={toggle}
              align="right"
              className="hidden sm:table-cell"
            />
            <SortHead
              label="Spent"
              column="cost"
              sort={sort}
              onSort={toggle}
              align="right"
              className="hidden sm:table-cell"
            />
            <SortHead
              label="Net (real money)"
              column="net"
              sort={sort}
              onSort={toggle}
              align="right"
            />
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.flatMap((group) => [
            grouped && (
              <TableRow key={`g-${group.firm}`} className="bg-muted/40 hover:bg-muted/40">
                <TableCell colSpan={7} className="text-sm font-medium">
                  {group.firm}{" "}
                  <span className="font-normal text-muted-foreground">
                    ({group.accounts.length})
                  </span>
                </TableCell>
              </TableRow>
            ),
            ...group.accounts.map((view) => (
              <TableRow key={view.id} className="cursor-pointer" onClick={() => onOpen(view.id)}>
                <TableCell>
                  <button
                    type="button"
                    onClick={() => onOpen(view.id)}
                    className="rounded text-left font-medium hover:underline"
                  >
                    {view.name}
                  </button>
                  <p className="text-xs text-muted-foreground">
                    {!grouped && `${view.firm} · `}
                    {view.type === "funded" ? "Funded" : "Evaluation"}
                    {view.contents.transactions === 0 && (
                      <span className="text-yellow-700 dark:text-yellow-400">
                        {" "}
                        · No cost recorded
                      </span>
                    )}
                  </p>
                </TableCell>
                <TableCell className="hidden whitespace-nowrap text-muted-foreground sm:table-cell">
                  {formatDayYear(view.openedOn)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    <AccountStatusBadge status={view.status} />
                    {view.endedAt && (
                      <span className="text-xs text-muted-foreground">
                        {formatDay(view.endedAt)} {view.endedAt.slice(0, 4)}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="hidden text-right tabular-nums sm:table-cell">
                  {view.lifetimeDays === null ? "—" : `${view.lifetimeDays} d`}
                </TableCell>
                <TableCell className="hidden text-right tabular-nums sm:table-cell">
                  {formatUsd(view.progress.balance)}
                </TableCell>
                <TableCell className="hidden text-right tabular-nums sm:table-cell">
                  {formatUsd(view.money.cost)}
                </TableCell>
                <TableCell
                  className={cn("text-right font-medium tabular-nums", pnlColor(view.money.net))}
                >
                  {formatUsd(view.money.net)}
                </TableCell>
              </TableRow>
            )),
          ])}
        </TableBody>
      </Table>
    </Card>
  )
}
