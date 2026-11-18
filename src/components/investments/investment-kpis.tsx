import { kpiCard, SemiGauge } from "@/components/dashboard/kpi-cards"
import type { GaugeLabels } from "@/components/dashboard/gauges"
import { InfoTip } from "@/components/info-tip"
import { Card } from "@/components/ui/card"
import { formatPercent, formatUsd, pnlColor } from "@/lib/format"
import type { InvestmentReport } from "@/lib/investments/investment-report"
import { cn } from "@/lib/utils"

const EVALUATION_LABELS: GaugeLabels = {
  win: ["passed evaluation", "passed evaluations"],
  be: ["evaluation in progress", "evaluations in progress"],
  loss: ["blown", "blown"],
}

const value = "text-xl font-semibold sm:text-2xl"
const hint = "text-xs text-muted-foreground"

function usdOrDash(amount: number | null) {
  return amount === null ? "—" : formatUsd(amount)
}

/**
 * Same skeleton for every card: title (with an optional info bubble for the explanations), then the
 * figure with an optional gauge on its right, then at most one short line.
 */
function Stat({
  title,
  info,
  aside,
  children,
}: {
  title: string
  info?: React.ReactNode
  aside?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Card className={cn(kpiCard, "gap-1.5 p-4 sm:p-5")}>
      <p className="flex items-center gap-1 text-sm text-muted-foreground">
        {title}
        {info && <InfoTip label={`Info: ${title}`}>{info}</InfoTip>}
      </p>
      {aside ? (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 space-y-1.5">{children}</div>
          <div className="max-sm:hidden">{aside}</div>
        </div>
      ) : (
        children
      )}
    </Card>
  )
}

export function InvestmentKpis({ report }: { report: InvestmentReport }) {
  const { evaluations, accounts } = report
  return (
    <div className="stagger grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      <Stat
        title="Spent"
        info={<p>Evaluations, resets, activations, subscriptions and other fees.</p>}
      >
        <p className={value}>{formatUsd(report.cost)}</p>
      </Stat>

      <Stat title="Payouts received">
        <p className={cn(value, report.payouts > 0 && "text-profit-text")}>
          {formatUsd(report.payouts)}
        </p>
        <p className={hint}>
          {accounts.funded} funded account{accounts.funded > 1 ? "s" : ""}
          {accounts.funded > 1 ? "s" : ""}
        </p>
      </Stat>

      <Stat
        title="Net"
        info={
          <p>
            {report.net < 0
              ? `${formatUsd(-report.net)} still to withdraw to break even.`
              : report.cost > 0
                ? "Above break-even."
                : "No spending entered."}
          </p>
        }
      >
        <p className={cn(value, pnlColor(report.net))}>{formatUsd(report.net)}</p>
      </Stat>

      <Stat title="ROI" info={<p>(Payouts − spending) ÷ spending.</p>}>
        <p className={cn(value, report.roi === null ? "" : pnlColor(report.roi))}>
          {formatPercent(report.roi)}
        </p>
      </Stat>

      <Stat
        title="Pass rate"
        info={<p>Passed, in-progress and blown evaluations (left to right on the gauge).</p>}
        aside={
          <SemiGauge
            wins={evaluations.passed}
            breakeven={evaluations.inProgress}
            losses={evaluations.failed}
            labels={EVALUATION_LABELS}
          />
        }
      >
        <p className={value}>{formatPercent(report.passRate)}</p>
      </Stat>

      <Stat title="Accounts">
        <p className={value}>{accounts.total}</p>
        <p className={hint}>
          {accounts.active} active · {accounts.blown} blown · {accounts.closed} closed
        </p>
      </Stat>

      <Stat
        title="Cost per funded account"
        info={<p>Total spending divided by the number of funded accounts.</p>}
      >
        <p className={value}>{usdOrDash(report.costPerFundedAccount)}</p>
        <p className={hint}>Average payout: {usdOrDash(report.payoutPerFundedAccount)}</p>
      </Stat>

      <Stat
        title="Blown account lifetime"
        info={<p>Average time between an account&apos;s first purchase and its blown date.</p>}
      >
        <p className={value}>
          {report.averageLifetimeDays === null ? "—" : `${report.averageLifetimeDays} d`}
        </p>
      </Stat>
    </div>
  )
}
