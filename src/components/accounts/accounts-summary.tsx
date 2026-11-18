import Link from "next/link"
import { KpiCard } from "@/components/dashboard/kpi-cards"
import { buttonVariants } from "@/components/ui/button"
import type { AccountsSummary } from "@/lib/accounts/account-views"
import { formatUsd, pnlColor } from "@/lib/format"
import { cn } from "@/lib/utils"

const value = "text-xl font-semibold sm:text-2xl tabular-nums"
const hint = "text-xs text-muted-foreground"

/** Four numbers on top of the accounts page: money, danger, today and what is missing. */
export function AccountsSummaryStrip({ summary }: { summary: AccountsSummary }) {
  const { atRisk, unmeasured, staleImports, neverImported } = summary
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      <KpiCard
        title={
          <>
            {/* The long title would take two lines in a half-width card and push its figure down. */}
            <span className="sm:hidden">Active balance</span>
            <span className="hidden sm:inline">Active accounts balance</span>
          </>
        }
      >
        <p className={value}>{formatUsd(summary.balance)}</p>
        <p className={hint}>
          {summary.count} active account{summary.count > 1 ? "s" : ""}
        </p>
      </KpiCard>

      <KpiCard title="Accounts at risk">
        <p className={cn(value, atRisk > 0 && "text-loss-text")}>{atRisk}</p>
        <p className={hint}>
          {atRisk > 0 ? "Margin under 25% or daily limit almost reached" : "All have room"}
          {unmeasured > 0 && ` · ${unmeasured} with no rule to measure`}
        </p>
      </KpiCard>

      <KpiCard title="Today's P&L">
        <p className={cn(value, pnlColor(summary.todayPnl))}>
          {summary.todayPnl > 0 ? "+" : ""}
          {formatUsd(summary.todayPnl)}
        </p>
        <p className={hint}>Current session, all active accounts</p>
      </KpiCard>

      <KpiCard
        title="Imports to redo"
        aside={
          staleImports + neverImported > 0 && (
            <Link href="/import" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Import
            </Link>
          )
        }
      >
        <p className={cn(value, staleImports > 0 && "text-yellow-600 dark:text-yellow-400")}>
          {staleImports}
        </p>
        <p className={hint}>
          {staleImports === 0 && neverImported === 0
            ? "All accounts are up to date"
            : neverImported > 0
              ? `${neverImported} never imported`
              : "Session probably missing"}
        </p>
      </KpiCard>
    </div>
  )
}
