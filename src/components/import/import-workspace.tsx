"use client"

import { ChevronRight, History, Loader2, RefreshCw, Search } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useActionState, useEffect, useMemo, useState } from "react"
import {
  cancelSyncAction,
  requestSyncAction,
  type SyncActionState,
} from "@/app/(app)/import/sync-actions"
import { AccountStatusBadge } from "@/components/account-status-badge"
import { AccountSuggestions } from "@/components/accounts/account-suggestions"
import { selectClass } from "@/components/form-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatAgo } from "@/lib/accounts/import-freshness"
import {
  canFinalSync,
  countRows,
  filterRows,
  firmKey,
  groupImportRows,
  importRows,
  startsOpen,
  type ImportRow,
  type ScopeFilter,
} from "@/lib/accounts/import-overview"
import type { Suggestion } from "@/lib/accounts/suggestions"
import { formatDay, formatImportTime } from "@/lib/format"
import type { SyncMode } from "@/lib/sync/cloud-dispatch"
import { splitResultMessage, type ResultLine } from "@/lib/sync/result-message"
import { CANCELLED_MESSAGE } from "@/lib/sync/sync-input"
import { dayKey } from "@/lib/trading/stats"
import { cn } from "@/lib/utils"

export interface WorkspaceAccount {
  id: string
  name: string
  firm: string
  type: "eval" | "funded"
  status: "active" | "blown" | "closed"
  lastImportedAt: string | null
  lastTradeAt: string | null
  endedAt: string | null
  notFoundAt: string | null
}

export interface SyncRun {
  id: string
  accountId: string | null
  accountName: string | null
  firm: string | null
  status: "pending" | "running" | "done" | "failed" | "needs_login"
  message: string | null
  requestedAt: string
  finishedAt: string | null
}

export interface ImportWorkspaceProps {
  /** How the Sync buttons work (see `syncMode`), or null when the sync is not set up. */
  mode: SyncMode | null
  /** The moment the page was rendered, so server and browser agree on every "x ago". */
  now: string
  accounts: WorkspaceAccount[]
  /** The latest syncs, newest first. */
  runs: SyncRun[]
  /** Accounts that look finished, to confirm. */
  suggestions: Suggestion[]
}

type Run = SyncRun

const date = (value: string | null) => (value ? new Date(value) : null)

/** The page: figures, the sync control, the accounts grouped by prop firm, and the recent syncs. */
export function ImportWorkspace({
  mode,
  now: nowText,
  accounts,
  runs,
  suggestions,
}: ImportWorkspaceProps) {
  const router = useRouter()
  const configured = mode !== null
  const now = useMemo(() => new Date(nowText), [nowText])
  const [state, action, pending] = useActionState<SyncActionState, FormData>(requestSyncAction, {})
  const latest = runs[0] ?? null
  const busy = latest?.status === "pending" || latest?.status === "running"

  const rows = useMemo(
    () =>
      importRows(
        accounts.map((account) => ({
          ...account,
          lastImportedAt: date(account.lastImportedAt),
          lastTradeAt: date(account.lastTradeAt),
          notFoundAt: date(account.notFoundAt),
        })),
        now
      ),
    [accounts, now]
  )
  const counts = useMemo(() => countRows(rows), [rows])

  // While the cloud run works, look again every few seconds to show where it is.
  useEffect(() => {
    if (!busy) return
    const timer = setInterval(() => router.refresh(), 3000)
    return () => clearInterval(timer)
  }, [busy, router])

  if (accounts.length === 0) {
    return (
      <section className="rounded-xl border bg-card p-8 text-center">
        <h2 className="text-lg font-medium">No account yet</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          Add your prop firm accounts first: trades are matched to an account by the Tradovate name
          you give it.
        </p>
        <Button className="mt-4" nativeButton={false} render={<Link href="/accounts" />}>
          Add an account
        </Button>
      </section>
    )
  }

  return (
    <div className="space-y-6">
      <AccountSuggestions suggestions={suggestions} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Active accounts" value={counts.active} />
        <Stat
          label="Up to date"
          value={counts.fresh}
          tone={counts.fresh > 0 ? "good" : undefined}
        />
        <Stat label="Behind" value={counts.stale} tone={counts.stale > 0 ? "warn" : undefined} />
        <Stat
          label="Never imported"
          value={counts.never}
          tone={counts.never > 0 ? "warn" : undefined}
        />
      </div>

      <SyncBar
        mode={mode}
        busy={busy}
        pending={pending}
        action={action}
        error={state.error}
        latest={latest}
        activeCount={counts.active}
        now={now}
      />

      <AccountList
        rows={rows}
        counts={counts}
        busy={busy}
        pending={pending}
        configured={configured}
        action={action}
        latest={latest}
        now={now}
      />

      {runs.length > 0 && <Recent runs={runs} now={now} />}
    </div>
  )
}

const toneClass = { good: "text-profit-text", warn: "text-yellow-700 dark:text-yellow-400" }

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone?: keyof typeof toneClass
}) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={cn("text-xl font-semibold sm:text-2xl tabular-nums", tone && toneClass[tone])}>
        {value}
      </p>
    </div>
  )
}

type SyncAction = (formData: FormData) => void

/** A button that asks for a cloud sync: of one account, of a prop firm, or of every active account. */
function SyncButton({
  action,
  field,
  value,
  label,
  suffix,
  ariaLabel,
  disabled,
  working,
  primary = false,
}: {
  action: SyncAction
  field: "account" | "firm"
  value: string
  label: string
  /** Shown after the label from small screens up only (a long prop firm name). */
  suffix?: string
  ariaLabel: string
  disabled: boolean
  working: boolean
  primary?: boolean
}) {
  return (
    <form action={action} className="inline-flex">
      <input type="hidden" name={field} value={value} />
      <Button
        type="submit"
        size={primary ? "default" : "xs"}
        variant={primary ? "default" : "outline"}
        disabled={disabled}
        aria-label={ariaLabel}
      >
        {working ? <Loader2 className="animate-spin" /> : <RefreshCw />}
        {label}
        {suffix && <span className="hidden sm:inline">{` ${suffix}`}</span>}
      </Button>
    </form>
  )
}

function SyncBar({
  mode,
  busy,
  pending,
  action,
  error,
  latest,
  activeCount,
  now,
}: {
  mode: SyncMode | null
  busy: boolean
  pending: boolean
  action: SyncAction
  error?: string
  latest: Run | null
  activeCount: number
  now: Date
}) {
  if (mode === null) {
    return (
      <section className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Automatic sync is not set up.</span> It needs{" "}
        <code className="font-mono">SYNC_TOKEN</code>,{" "}
        <code className="font-mono">CLOUD_SYNC_REPO</code> and{" "}
        <code className="font-mono">CLOUD_SYNC_TOKEN</code> in the app&apos;s environment, or import
        files by hand below.
      </section>
    )
  }
  return (
    <section className="rounded-xl border bg-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-medium">Sync from Tradovate</h2>
          <Outcome latest={latest} now={now} local={mode === "local"} />
          {error && (
            <p role="alert" className="mt-1 text-sm text-loss-text">
              {error}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SyncButton
            action={action}
            field="account"
            value="all"
            label={`Sync all active (${activeCount})`}
            ariaLabel="Sync all active accounts"
            disabled={pending || busy || activeCount === 0}
            working={pending || (busy && isAll(latest))}
            primary
          />
        </div>
      </div>
    </section>
  )
}

const isAll = (run: Run | null) => run !== null && run.accountId === null && run.firm === null

function Outcome({ latest, now, local }: { latest: Run | null; now: Date; local: boolean }) {
  if (!latest) {
    return (
      <p className="mt-1 text-sm text-muted-foreground">
        One click exports and imports what is missing. Nothing synced yet.
      </p>
    )
  }
  const when = formatAgo(new Date(latest.finishedAt ?? latest.requestedAt), now)
  switch (latest.status) {
    case "pending":
      return (
        <div className="mt-1 flex flex-wrap items-center gap-3 text-sm">
          {local ? (
            <>Starting the run on this PC… (asked {when})</>
          ) : (
            <>Starting the cloud run… (asked {when})</>
          )}
          <CancelButton />
        </div>
      )
    case "running":
      return (
        <div className="mt-1 flex flex-wrap items-center gap-3 text-sm">
          Syncing in the cloud… (usually about a minute)
          <CancelButton />
        </div>
      )
    case "done":
      return (
        <Result title={`Done ${when}.`} message={latest.message} className="text-profit-text" />
      )
    case "needs_login":
      return (
        <Result
          title={`Action needed ${when}.`}
          message={latest.message}
          className="text-yellow-700 dark:text-yellow-400"
          alert
        />
      )
    case "failed":
      return latest.message === CANCELLED_MESSAGE ? (
        <p className="mt-1 text-sm text-muted-foreground">Cancelled {when}.</p>
      ) : (
        <Result
          title={`Finished with errors ${when}.`}
          message={latest.message}
          className="text-loss-text"
          alert
        />
      )
  }
}

/** A sync's result: its summary line, then one line per account or prop firm. */
function Result({
  title,
  message,
  className,
  alert = false,
}: {
  title: string
  message: string | null
  className: string
  alert?: boolean
}) {
  const { summary, problems, synced } = splitResultMessage(message)
  return (
    <div role={alert ? "alert" : undefined} className={cn("mt-1 text-sm", className)}>
      <p className="font-medium">
        {title} {summary}
      </p>
      <ResultDetails problems={problems} synced={synced} />
    </div>
  )
}

/** One result line; its technical detail (a failure's log) is folded under it. */
function ResultLineView({ line, detail }: ResultLine) {
  return (
    <div>
      <p className="whitespace-pre-line">{line}</p>
      {detail.length > 0 && (
        <details className="mt-0.5 text-muted-foreground">
          <summary className="cursor-pointer text-xs">Show details</summary>
          <pre className="mt-1 max-h-48 overflow-auto rounded-md bg-muted p-2 text-xs whitespace-pre-wrap">
            {detail.join("\n")}
          </pre>
        </details>
      )}
    </div>
  )
}

/** The lines that need a look stay in view; the accounts that synced fine are folded away. */
function ResultDetails({ problems, synced }: { problems: ResultLine[]; synced: ResultLine[] }) {
  return (
    <>
      {problems.length > 0 && (
        <div className="mt-1 space-y-1">
          {problems.map((problem, index) => (
            <ResultLineView key={index} {...problem} />
          ))}
        </div>
      )}
      {synced.length > 0 && (
        <details className="mt-1 text-muted-foreground">
          <summary className="cursor-pointer">
            Show {synced.length} synced {synced.length === 1 ? "account" : "accounts"}
          </summary>
          <div className="mt-1 space-y-1">
            {synced.map((item, index) => (
              <ResultLineView key={index} {...item} />
            ))}
          </div>
        </details>
      )}
    </>
  )
}

function CancelButton() {
  return (
    <form action={cancelSyncAction}>
      <Button type="submit" variant="outline" size="sm">
        Cancel
      </Button>
    </form>
  )
}

const scopes: { value: ScopeFilter; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "ended", label: "Ended" },
  { value: "all", label: "All" },
]

function AccountList({
  rows,
  counts,
  busy,
  pending,
  configured,
  action,
  latest,
  now,
}: {
  rows: ImportRow[]
  counts: ReturnType<typeof countRows>
  busy: boolean
  pending: boolean
  configured: boolean
  action: SyncAction
  latest: Run | null
  now: Date
}) {
  const [query, setQuery] = useState("")
  const [firm, setFirm] = useState("all")
  const [scope, setScope] = useState<ScopeFilter>("active")
  const [attentionOnly, setAttentionOnly] = useState(false)
  const [opened, setOpened] = useState<Record<string, boolean>>({})

  const firms = useMemo(() => groupImportRows(rows).map((group) => group.firm), [rows])
  const shown = useMemo(
    () => filterRows(rows, { query, firm, scope, attentionOnly }),
    [rows, query, firm, scope, attentionOnly]
  )
  const groups = useMemo(() => groupImportRows(shown), [shown])
  const searching = query.trim() !== ""
  const forcedOpen = searching || attentionOnly
  const allOpen = groups.every((group) => opened[firmKey(group.firm)] ?? startsOpen(rows.length))
  const setAll = (value: boolean) =>
    setOpened(Object.fromEntries(groups.map((group) => [firmKey(group.firm), value])))
  const attention = counts.stale + counts.never

  /** Whether the running sync covers this row, to show the spinner where the work is. */
  const syncing = (row: ImportRow) =>
    busy &&
    latest !== null &&
    (latest.accountId === row.id ||
      (row.state !== "ended" &&
        latest.accountId === null &&
        (latest.firm === null || firmKey(latest.firm) === firmKey(row.firm))))

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div
          className="inline-flex rounded-lg border p-0.5"
          role="group"
          aria-label="Accounts shown"
        >
          {scopes.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={scope === option.value}
              onClick={() => setScope(option.value)}
              className={cn(
                "rounded-md px-3 py-1 text-sm transition-colors",
                scope === option.value
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {option.label}
              <span className="ml-1.5 text-xs tabular-nums opacity-70">
                {option.value === "active"
                  ? counts.active
                  : option.value === "ended"
                    ? counts.ended
                    : counts.active + counts.ended}
              </span>
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search an account"
            placeholder="Search…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-44 pl-8"
          />
        </div>
        {firms.length > 1 && (
          <select
            aria-label="Prop firm"
            className={selectClass}
            value={firm}
            onChange={(event) => setFirm(event.target.value)}
          >
            <option value="all">All prop firms</option>
            {firms.map((name) => (
              <option key={name} value={firmKey(name)}>
                {name}
              </option>
            ))}
          </select>
        )}
        {groups.length > 1 && !forcedOpen && (
          <Button variant="ghost" size="sm" onClick={() => setAll(!allOpen)}>
            {allOpen ? "Collapse all" : "Expand all"}
          </Button>
        )}
        {attention > 0 && (
          <label className="flex min-h-8 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={attentionOnly}
              onChange={(event) => setAttentionOnly(event.target.checked)}
              className="size-4"
            />
            Needs an import ({attention})
          </label>
        )}
      </div>

      {groups.length === 0 ? (
        <p className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
          {attentionOnly && !searching
            ? "Everything is up to date."
            : "No account matches these filters."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card p-2">
          <Table className="[&_td]:px-2 [&_th]:px-2">
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead className="hidden sm:table-cell">Status</TableHead>
                <TableHead className="hidden sm:table-cell">Last import</TableHead>
                <TableHead className="hidden md:table-cell">Last trade</TableHead>
                <TableHead className="hidden sm:table-cell">State</TableHead>
                <TableHead className="w-px" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((group) => {
                const key = firmKey(group.firm)
                const open = forcedOpen || (opened[key] ?? startsOpen(rows.length))
                const todo = group.counts.stale + group.counts.never
                return (
                  <FirmRows
                    key={key}
                    group={group}
                    open={open}
                    todo={todo}
                    onToggle={() => setOpened((current) => ({ ...current, [key]: !open }))}
                    firmSync={
                      configured && group.counts.active > 0 ? (
                        <SyncButton
                          action={action}
                          field="firm"
                          value={group.firm}
                          label="Sync"
                          suffix={group.firm}
                          ariaLabel={`Sync all active ${group.firm} accounts`}
                          disabled={pending || busy}
                          working={
                            busy &&
                            latest !== null &&
                            latest.accountId === null &&
                            latest.firm !== null &&
                            firmKey(latest.firm) === key
                          }
                        />
                      ) : null
                    }
                  >
                    {group.rows.map((row) => (
                      <AccountRow
                        key={row.id}
                        row={row}
                        now={now}
                        sync={
                          configured && (row.state !== "ended" || canFinalSync(row, now)) ? (
                            <SyncButton
                              action={action}
                              field="account"
                              value={row.id}
                              label={row.state === "ended" ? "Final sync" : "Sync"}
                              ariaLabel={`${row.state === "ended" ? "Final sync of" : "Sync"} ${row.name}`}
                              disabled={pending || busy}
                              working={syncing(row)}
                            />
                          ) : null
                        }
                      />
                    ))}
                  </FirmRows>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  )
}

function FirmRows({
  group,
  open,
  todo,
  onToggle,
  firmSync,
  children,
}: {
  group: ReturnType<typeof groupImportRows>[number]
  open: boolean
  todo: number
  onToggle: () => void
  firmSync: React.ReactNode
  children: React.ReactNode
}) {
  const { counts } = group
  return (
    <>
      <TableRow className="bg-muted/40 hover:bg-muted/40">
        <TableCell colSpan={5}>
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            className="flex w-full items-center gap-2 rounded text-left text-sm font-medium"
          >
            <ChevronRight
              className={cn(
                "size-4 text-muted-foreground transition-transform",
                open && "rotate-90"
              )}
            />
            {group.firm}
            <span className="font-normal text-muted-foreground">
              {counts.active > 0 && `${counts.active} active`}
              {counts.active > 0 && counts.ended > 0 && " · "}
              {counts.ended > 0 && `${counts.ended} ended`}
            </span>
            {todo > 0 && (
              <span className="rounded bg-yellow-500/15 px-1.5 text-xs font-medium text-yellow-700 dark:text-yellow-400">
                {todo} to import
              </span>
            )}
          </button>
        </TableCell>
        <TableCell className="text-right">{firmSync}</TableCell>
      </TableRow>
      {open && children}
    </>
  )
}

function AccountRow({ row, now, sync }: { row: ImportRow; now: Date; sync: React.ReactNode }) {
  const ended = row.state === "ended"
  return (
    <TableRow className={cn(ended && "text-muted-foreground")}>
      <TableCell>
        <p className={cn("font-medium", !ended && "text-foreground")}>{row.name}</p>
        <p className="text-xs text-muted-foreground">
          {row.type === "funded" ? "Funded" : "Evaluation"}
          {row.notFoundAt && !ended && (
            <span className="font-medium text-loss-text"> · Not found in Tradovate</span>
          )}
        </p>
        {/* Narrow screens have no room for the columns: the state goes under the name. */}
        <p className="mt-0.5 text-xs sm:hidden">
          <StateLabel row={row} />
          {row.lastImportedAt && (
            <span className="text-muted-foreground"> · {formatAgo(row.lastImportedAt, now)}</span>
          )}
        </p>
      </TableCell>
      <TableCell className="hidden sm:table-cell">
        <AccountStatusBadge status={row.status} />
      </TableCell>
      <TableCell className="hidden sm:table-cell">
        {row.lastImportedAt ? (
          <span title={formatImportTime(row.lastImportedAt)}>
            {formatAgo(row.lastImportedAt, now)}
          </span>
        ) : (
          "—"
        )}
      </TableCell>
      <TableCell className="hidden md:table-cell">
        {row.lastTradeAt ? formatDay(dayKey(row.lastTradeAt)) : "—"}
      </TableCell>
      <TableCell className="hidden sm:table-cell">
        <StateLabel row={row} />
      </TableCell>
      <TableCell className="text-right">{sync}</TableCell>
    </TableRow>
  )
}

function StateLabel({ row }: { row: ImportRow }) {
  switch (row.state) {
    case "fresh":
      return <span className="text-profit-text">Up to date</span>
    case "stale":
      return (
        <span className="font-medium text-yellow-700 dark:text-yellow-400">Needs an import</span>
      )
    case "never":
      return (
        <span className="font-medium text-yellow-700 dark:text-yellow-400">Never imported</span>
      )
    case "ended":
      return <span>{row.endedAt ? `Ended ${formatDay(row.endedAt)}` : "Ended"}</span>
  }
}

const dot: Record<Run["status"], string> = {
  pending: "bg-muted-foreground/50",
  running: "bg-muted-foreground/50",
  done: "bg-profit",
  failed: "bg-loss",
  needs_login: "bg-yellow-500",
}

/** The last few syncs, folded away: one failure on Monday must not hide behind Tuesday's success. */
function Recent({ runs, now }: { runs: Run[]; now: Date }) {
  const scopeText = (run: Run) =>
    run.accountId ? (run.accountName ?? "One account") : (run.firm ?? "All active accounts")
  return (
    <details className="group rounded-xl border bg-card">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-4 text-muted-foreground transition-transform group-open:rotate-90" />
        <History className="size-4 text-muted-foreground" />
        Recent syncs
        <span className="font-normal text-muted-foreground">({runs.length})</span>
      </summary>
      <ul className="divide-y border-t px-4">
        {runs.map((run) => (
          <li key={run.id} className="flex flex-wrap items-start gap-x-3 gap-y-1 py-2.5 text-sm">
            <span
              aria-hidden
              className={cn("mt-1.5 size-2 shrink-0 rounded-full", dot[run.status])}
            />
            <span className="w-28 shrink-0 text-muted-foreground max-sm:w-auto">
              {formatAgo(new Date(run.finishedAt ?? run.requestedAt), now)}
            </span>
            <span className="w-36 shrink-0 font-medium max-sm:w-auto max-sm:min-w-0 max-sm:flex-1">
              {scopeText(run)}
            </span>
            {/* On a phone the message goes under the line above, on the full width (beside it, it had a few pixels). */}
            <div className="min-w-0 flex-1 break-words text-muted-foreground max-sm:basis-full max-sm:pl-5">
              {run.status === "pending" && "Starting the cloud run…"}
              {run.status === "running" && "In progress…"}
              {run.status !== "pending" && run.status !== "running" && (
                <RunMessage message={run.message} />
              )}
            </div>
          </li>
        ))}
      </ul>
    </details>
  )
}

function RunMessage({ message }: { message: string | null }) {
  const { summary, problems, synced } = splitResultMessage(message)
  return (
    <>
      <p>{summary || "—"}</p>
      <ResultDetails problems={problems} synced={synced} />
    </>
  )
}
