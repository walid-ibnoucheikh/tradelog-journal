import { ImportFreshness } from "@/components/import-freshness"
import { DRAWDOWN_TYPES } from "@/lib/accounts/account-rules"
import type { AccountView } from "@/lib/accounts/account-views"
import { formatDay, formatUsd, pnlColor } from "@/lib/format"
import { cn } from "@/lib/utils"
import { Meter, marginTone, usedTone } from "./risk"

function Row({
  label,
  value,
  children,
}: {
  label: string
  value: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value}</span>
      </div>
      {children}
    </div>
  )
}

const day = (date: string) => `${formatDay(date)} ${date.slice(0, 4)}`

/** The full picture of one account: balance, progress against each rule, import and key facts. */
export function AccountDetails({
  view,
  now,
  onAddPayment,
}: {
  view: AccountView
  now: Date
  /** Opens the payment form; the notices below offer it when nothing was recorded yet. */
  onAddPayment?: () => void
}) {
  const { progress } = view
  const { target, drawdown, dailyLoss, consistency } = progress
  const finished = view.status !== "active"

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-muted-foreground">Balance</p>
        <p className="text-xl font-semibold sm:text-2xl">{formatUsd(progress.balance)}</p>
        <p className={cn("text-sm", pnlColor(progress.profit))}>
          {progress.profit > 0 ? "+" : ""}
          {formatUsd(progress.profit)} since the start
        </p>
      </div>

      {!finished && target && (
        <Row
          label="Profit target"
          value={
            target.reached
              ? "Reached"
              : `${formatUsd(Math.max(0, progress.profit))} / ${formatUsd(target.amount)}`
          }
        >
          <Meter percent={target.percent} className="bg-profit" label="Profit target" />
          <p className="text-xs text-muted-foreground">
            {target.reached
              ? `${formatUsd(progress.profit - target.amount)} above the target`
              : `${Math.round(target.percent)}% · ${formatUsd(target.remaining)} to go`}
          </p>
        </Row>
      )}

      {!finished && drawdown && (
        <Row
          label="Liquidation threshold"
          value={<span className="text-lg">{formatUsd(drawdown.threshold)}</span>}
        >
          <p className="text-xs text-muted-foreground">
            {DRAWDOWN_TYPES.find((t) => t.value === drawdown.type)?.label} drawdown of{" "}
            {formatUsd(drawdown.maxDrawdown)}: it trails your balance peak.
            {drawdown.locked && ` Locked at ${formatUsd(drawdown.threshold)}.`}
            {drawdown.risesAtSessionEnd &&
              ` It will rise to ${formatUsd(Math.min(progress.balance - drawdown.maxDrawdown, view.rules.drawdownLockLevel ?? Infinity))} when the session ends.`}
          </p>
        </Row>
      )}

      {!finished && drawdown && (
        <Row
          label="Margin before the threshold"
          value={
            drawdown.breached ? (
              <span className="text-loss-text">Threshold reached</span>
            ) : (
              formatUsd(drawdown.distance)
            )
          }
        >
          <Meter
            percent={drawdown.percentRemaining}
            className={marginTone(drawdown.percentRemaining)}
            label="Margin before the drawdown threshold"
          />
          <p className="text-xs text-muted-foreground">
            Balance {formatUsd(progress.balance)} · threshold {formatUsd(drawdown.threshold)}
          </p>
        </Row>
      )}

      {!finished && dailyLoss && (
        <Row
          label="Today's loss"
          value={`${formatUsd(dailyLoss.lostToday)} / ${formatUsd(dailyLoss.limit)}`}
        >
          <Meter
            percent={Math.min(100, (dailyLoss.lostToday / dailyLoss.limit) * 100)}
            className={usedTone((dailyLoss.lostToday / dailyLoss.limit) * 100)}
            label="Today's loss"
          />
          <p
            className={cn(
              "text-xs",
              dailyLoss.breached ? "text-loss-text" : "text-muted-foreground"
            )}
          >
            {dailyLoss.breached
              ? "Daily limit reached"
              : `${formatUsd(dailyLoss.remaining)} left today`}
          </p>
        </Row>
      )}

      {!finished && consistency && (
        <Row
          label={`Consistency (${consistency.limitPercent}%)`}
          value={
            <span className={consistency.compliant ? undefined : "text-loss-text"}>
              {consistency.share === null ? "—" : `${consistency.share.toFixed(2)}%`}
            </span>
          }
        >
          <Meter
            percent={
              consistency.share === null
                ? 0
                : Math.min(100, (consistency.share / consistency.limitPercent) * 100)
            }
            className={consistency.compliant ? "bg-profit" : "bg-loss"}
            label="Consistency"
          />
          <p className="text-xs text-muted-foreground">
            {consistency.compliant
              ? `Best day ${formatUsd(consistency.bestDay)} of ${formatUsd(progress.profit)} profit`
              : `${formatUsd(consistency.leftToEarn)} left to earn to get back under the limit`}
          </p>
        </Row>
      )}

      {!finished && !target && !drawdown && !dailyLoss && !consistency && (
        <p className="text-sm text-muted-foreground">
          No rules entered: add a target or a max drawdown (Rules tab) to track this account.
        </p>
      )}

      {!finished && (
        <ImportFreshness
          lastImportedAt={view.lastImportedAt ? new Date(view.lastImportedAt) : null}
          lastTradeAt={view.lastTradeAt ? new Date(view.lastTradeAt) : null}
          now={now}
        />
      )}

      <dl className="space-y-1.5 border-t pt-4 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Tradovate account</dt>
          <dd className="font-mono text-xs">{view.tradovateName}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Initial balance</dt>
          <dd>{formatUsd(view.initialBalance)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Purchased on</dt>
          <dd>{day(view.openedOn)}</dd>
        </div>
        {view.fundedAt && (
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Funded</dt>
            <dd>{day(view.fundedAt)}</dd>
          </div>
        )}
        {view.endedAt && (
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">
              {view.status === "blown" ? "Blown on" : "Closed on"}
            </dt>
            <dd>{day(view.endedAt)}</dd>
          </div>
        )}
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Spent / payouts</dt>
          <dd>
            {formatUsd(view.money.cost)} / {formatUsd(view.money.payouts)}
          </dd>
        </div>
      </dl>
      {view.contents.transactions === 0 ? (
        <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm">
          <p className="font-medium text-yellow-800 dark:text-yellow-300">No cost recorded</p>
          <p className="mt-0.5 text-muted-foreground">
            Spending, ROI and the cost per funded account leave this account out until you add what
            you paid.
          </p>
          {onAddPayment && (
            <button
              type="button"
              onClick={onAddPayment}
              className="mt-2 rounded font-medium text-primary hover:underline"
            >
              Add what you paid
            </button>
          )}
        </div>
      ) : (
        onAddPayment && (
          <button
            type="button"
            onClick={onAddPayment}
            className="rounded text-sm font-medium text-primary hover:underline"
          >
            Add payment (reset, activation, payout…)
          </button>
        )
      )}
    </div>
  )
}
