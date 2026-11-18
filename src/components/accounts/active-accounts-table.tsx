"use client"

import { ChevronDown, ChevronRight } from "lucide-react"
import { useState } from "react"
import { SortHead, useSort } from "@/components/sortable-head"
import { Card } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table"
import type { AccountView } from "@/lib/accounts/account-views"
import { groupAccountsByFirm } from "@/lib/accounts/groups"
import { formatAgo } from "@/lib/accounts/import-freshness"
import { formatDayYear, formatUsd, pnlColor } from "@/lib/format"
import { sortRows } from "@/lib/sort"
import { cn } from "@/lib/utils"
import { Meter, RiskIcon, marginTone, usedTone } from "./risk"

type Column =
  | "risk"
  | "name"
  | "balance"
  | "threshold"
  | "opened"
  | "target"
  | "margin"
  | "daily"
  | "consistency"
  | "import"

const value: Record<Column, (view: AccountView) => string | number | null> = {
  risk: (view) => view.riskScore,
  name: (view) => view.name,
  balance: (view) => view.progress.balance,
  threshold: (view) => view.progress.drawdown?.threshold ?? null,
  opened: (view) => view.openedOn,
  target: (view) => view.progress.target?.percent ?? null,
  margin: (view) => view.progress.drawdown?.percentRemaining ?? null,
  daily: (view) =>
    view.progress.dailyLoss
      ? (view.progress.dailyLoss.lostToday / view.progress.dailyLoss.limit) * 100
      : null,
  consistency: (view) => view.progress.consistency?.share ?? null,
  import: (view) => (view.lastImportedAt ? Date.parse(view.lastImportedAt) : null),
}

const rowTint: Partial<Record<AccountView["risk"], string>> = {
  breached: "bg-loss/10",
  danger: "bg-loss/5",
}

const importDot = { fresh: "bg-profit", stale: "bg-yellow-500", never: "bg-muted-foreground/40" }

function ImportCell({ view, now }: { view: AccountView; now: Date }) {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap text-xs text-muted-foreground">
      <span className={cn("size-2 rounded-full", importDot[view.importState])} aria-hidden />
      {view.importState === "never" ? (
        "Never"
      ) : (
        <>
          {view.importState === "stale" && (
            <span className="font-medium text-yellow-700 dark:text-yellow-400">To redo ·</span>
          )}
          {formatAgo(new Date(view.lastImportedAt!), now)}
        </>
      )}
    </span>
  )
}

function Row({
  view,
  now,
  showFirm,
  onOpen,
}: {
  view: AccountView
  now: Date
  showFirm: boolean
  onOpen: (id: string) => void
}) {
  const { target, drawdown, dailyLoss, consistency } = view.progress
  const profit = view.progress.profit
  return (
    <TableRow className={cn("cursor-pointer", rowTint[view.risk])} onClick={() => onOpen(view.id)}>
      <TableCell>
        <div className="flex items-center gap-2">
          <RiskIcon risk={view.risk} />
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => onOpen(view.id)}
              className="rounded text-left font-medium hover:underline"
            >
              {view.name}
            </button>
            <p className="text-xs text-muted-foreground">
              {showFirm && `${view.firm} · `}
              {view.type === "funded" ? "Funded" : "Evaluation"}
              {view.contents.transactions === 0 && (
                <span className="text-yellow-700 dark:text-yellow-400"> · No cost recorded</span>
              )}
            </p>
            {/* The margin column is hidden on a phone: its meter goes under the name instead. */}
            {drawdown && (
              <div className="mt-1.5 space-y-1 sm:hidden">
                <Meter
                  percent={drawdown.percentRemaining}
                  className={marginTone(drawdown.percentRemaining)}
                  label="Margin before the drawdown threshold"
                />
                <p
                  className={cn(
                    "text-xs tabular-nums",
                    drawdown.breached ? "font-medium text-loss-text" : "text-muted-foreground"
                  )}
                >
                  {drawdown.breached
                    ? "Threshold reached"
                    : `${formatUsd(drawdown.distance)} before ${formatUsd(drawdown.threshold)}`}
                </p>
              </div>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell className="text-right tabular-nums">
        <p className="font-medium">{formatUsd(view.progress.balance)}</p>
        <p className={cn("text-xs", pnlColor(profit))}>
          {profit > 0 ? "+" : ""}
          {formatUsd(profit)}
        </p>
      </TableCell>
      <TableCell className="hidden whitespace-nowrap sm:table-cell">
        {drawdown ? (
          <div>
            <p className="font-medium tabular-nums">{formatUsd(drawdown.threshold)}</p>
            <p className="text-xs text-muted-foreground">
              {drawdown.locked ? "Locked" : drawdown.type === "eod_trailing" ? "EOD" : "Intraday"}
              {drawdown.risesAtSessionEnd && " · rises at session end"}
            </p>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="hidden whitespace-nowrap text-muted-foreground lg:table-cell">
        {formatDayYear(view.openedOn)}
      </TableCell>
      <TableCell className="hidden w-24 lg:table-cell">
        {target ? (
          <div className="space-y-1">
            <Meter percent={target.percent} className="bg-profit" label="Profit target" />
            <p className="text-xs tabular-nums text-muted-foreground">
              {target.reached ? "Reached" : `${Math.round(target.percent)} %`}
            </p>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="hidden w-36 sm:table-cell">
        {drawdown ? (
          <div className="space-y-1">
            <Meter
              percent={drawdown.percentRemaining}
              className={marginTone(drawdown.percentRemaining)}
              label="Margin before the drawdown threshold"
            />
            <p
              className={cn(
                "text-xs tabular-nums",
                drawdown.breached ? "font-medium text-loss-text" : "text-muted-foreground"
              )}
            >
              {drawdown.breached ? "Threshold reached" : formatUsd(drawdown.distance)}
            </p>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="hidden w-24 lg:table-cell">
        {dailyLoss ? (
          <div className="space-y-1">
            <Meter
              percent={Math.min(100, (dailyLoss.lostToday / dailyLoss.limit) * 100)}
              className={usedTone((dailyLoss.lostToday / dailyLoss.limit) * 100)}
              label="Today's loss"
            />
            <p
              className={cn(
                "text-xs tabular-nums",
                dailyLoss.breached ? "font-medium text-loss-text" : "text-muted-foreground"
              )}
            >
              {formatUsd(dailyLoss.lostToday)} / {formatUsd(dailyLoss.limit)}
            </p>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="hidden w-24 xl:table-cell">
        {consistency ? (
          <div className="space-y-1">
            <Meter
              percent={
                consistency.share === null
                  ? 0
                  : Math.min(100, (consistency.share / consistency.limitPercent) * 100)
              }
              className={consistency.compliant ? "bg-profit" : "bg-loss"}
              label="Consistency"
            />
            <p
              className={cn(
                "text-xs tabular-nums",
                consistency.compliant ? "text-muted-foreground" : "font-medium text-loss-text"
              )}
            >
              {consistency.share === null ? "—" : `${consistency.share.toFixed(1)}%`} /{" "}
              {consistency.limitPercent}%
              {!consistency.compliant && ` · ${formatUsd(consistency.leftToEarn)} left`}
            </p>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="hidden 2xl:table-cell">
        <ImportCell view={view} now={now} />
      </TableCell>
    </TableRow>
  )
}

/** Active accounts, one line each, the riskiest first by default; optionally grouped by prop firm. */
export function ActiveAccountsTable({
  views,
  grouped,
  now,
  onOpen,
}: {
  views: AccountView[]
  grouped: boolean
  now: Date
  onOpen: (id: string) => void
}) {
  const { sort, toggle } = useSort<Column>(
    { key: "risk", direction: "asc" },
    {
      risk: "asc",
      name: "asc",
      threshold: "desc",
      opened: "desc",
      margin: "asc",
      daily: "desc",
      consistency: "desc",
      import: "asc",
    }
  )
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const sorted = sortRows(views, value[sort.key], sort.direction)
  const groups = grouped ? groupAccountsByFirm(sorted) : [{ firm: "", accounts: sorted }]

  function toggleGroup(firm: string) {
    setCollapsed((current) => {
      const next = new Set(current)
      if (!next.delete(firm)) next.add(firm)
      return next
    })
  }

  return (
    <Card className="overflow-x-auto p-2">
      <Table className="[&_td]:px-1.5 [&_th]:px-1.5">
        <TableHeader>
          <TableRow>
            <SortHead label="Account" column="name" sort={sort} onSort={toggle} />
            <SortHead label="Balance" column="balance" sort={sort} onSort={toggle} align="right" />
            <SortHead
              label="Liquidation"
              column="threshold"
              sort={sort}
              onSort={toggle}
              className="hidden sm:table-cell"
            />
            <SortHead
              label="Purchased on"
              column="opened"
              sort={sort}
              onSort={toggle}
              className="hidden lg:table-cell"
            />
            <SortHead
              label="Target"
              column="target"
              sort={sort}
              onSort={toggle}
              className="hidden lg:table-cell"
            />
            <SortHead
              label="Drawdown margin"
              column="margin"
              sort={sort}
              onSort={toggle}
              className="hidden sm:table-cell"
            />
            <SortHead
              label="Today's loss"
              column="daily"
              sort={sort}
              onSort={toggle}
              className="hidden lg:table-cell"
            />
            <SortHead
              label="Consistency"
              column="consistency"
              sort={sort}
              onSort={toggle}
              className="hidden xl:table-cell"
            />
            <SortHead
              label="Import"
              column="import"
              sort={sort}
              onSort={toggle}
              className="hidden 2xl:table-cell"
            />
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.flatMap((group) => [
            grouped && (
              <TableRow key={`g-${group.firm}`} className="bg-muted/40 hover:bg-muted/40">
                <TableCell colSpan={9}>
                  <button
                    type="button"
                    aria-expanded={!collapsed.has(group.firm)}
                    onClick={() => toggleGroup(group.firm)}
                    className="flex w-full items-center gap-2 text-sm font-medium"
                  >
                    {collapsed.has(group.firm) ? (
                      <ChevronRight className="size-4" />
                    ) : (
                      <ChevronDown className="size-4" />
                    )}
                    {group.firm}
                    <span className="font-normal text-muted-foreground">
                      ({group.accounts.length}) ·{" "}
                      {formatUsd(group.accounts.reduce((sum, a) => sum + a.progress.balance, 0))}
                    </span>
                  </button>
                </TableCell>
              </TableRow>
            ),
            ...(collapsed.has(group.firm)
              ? []
              : group.accounts.map((view) => (
                  <Row key={view.id} view={view} now={now} showFirm={!grouped} onOpen={onOpen} />
                ))),
          ])}
        </TableBody>
      </Table>
    </Card>
  )
}
