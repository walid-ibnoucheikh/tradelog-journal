"use client"

import { Search } from "lucide-react"
import { useMemo, useState } from "react"
import { usePhone } from "@/lib/use-phone"
import { selectClass } from "@/components/form-field"
import { Input } from "@/components/ui/input"
import type { AccountView } from "@/lib/accounts/account-views"
import { groupAccountsByFirm } from "@/lib/accounts/groups"
import { AccountPanel } from "./account-panel"
import { ActiveAccountsTable } from "./active-accounts-table"
import { EndedAccountsTable } from "./ended-accounts-table"

/** Filters and search only appear once there are enough accounts for them to be useful. */
const FILTERS_FROM = 8

const firmKey = (firm: string) => firm.trim().toLowerCase()

/** The accounts page body: both tables, their filters and the side panel of the selected account. */
export function AccountsWorkspace({
  active,
  ended,
  now: nowText,
}: {
  active: AccountView[]
  ended: AccountView[]
  now: string
}) {
  const now = useMemo(() => new Date(nowText), [nowText])
  const [query, setQuery] = useState("")
  const [firm, setFirm] = useState("all")
  const [type, setType] = useState("all")
  // Grouped by prop firm, except on a phone (a long folded list is slower to read there) until it is chosen.
  const phone = usePhone()
  const [groupedChoice, setGroupedChoice] = useState<boolean | null>(null)
  const grouped = groupedChoice ?? !phone
  const setGrouped = setGroupedChoice
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const all = useMemo(() => [...active, ...ended], [active, ended])
  const firms = useMemo(() => groupAccountsByFirm(all).map((group) => group.firm), [all])
  const matches = (view: AccountView) =>
    (firm === "all" || firmKey(view.firm) === firm) &&
    (type === "all" || view.type === type) &&
    [view.name, view.firm, view.tradovateName]
      .join(" ")
      .toLowerCase()
      .includes(query.trim().toLowerCase())
  const shownActive = active.filter(matches)
  const shownEnded = ended.filter(matches)
  // An account deleted from the panel is gone from the list: the panel closes with it.
  const selected = all.find((view) => view.id === selectedId) ?? null

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {all.length >= FILTERS_FROM && (
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Search an account"
                placeholder="Search…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="w-48 pl-8"
              />
            </div>
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
            <select
              aria-label="Type"
              className={selectClass}
              value={type}
              onChange={(event) => setType(event.target.value)}
            >
              <option value="all">Evaluation and funded</option>
              <option value="eval">Evaluation</option>
              <option value="funded">Funded</option>
            </select>
          </>
        )}
        <label className="ml-auto flex min-h-8 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={grouped}
            onChange={(event) => setGrouped(event.target.checked)}
            className="size-4"
          />
          Group by prop firm
        </label>
      </div>

      {shownActive.length > 0 ? (
        <ActiveAccountsTable
          views={shownActive}
          grouped={grouped}
          now={now}
          onOpen={setSelectedId}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          {active.length === 0
            ? "No active accounts yet."
            : "No active account matches these filters."}
        </p>
      )}

      {shownEnded.length > 0 && (
        <details className="space-y-4">
          <summary className="cursor-pointer text-lg font-medium">
            Ended accounts{" "}
            <span className="text-sm font-normal text-muted-foreground">({shownEnded.length})</span>
          </summary>
          <div className="mt-4">
            <EndedAccountsTable views={shownEnded} grouped={grouped} onOpen={setSelectedId} />
          </div>
        </details>
      )}

      <AccountPanel view={selected} now={now} onClose={() => setSelectedId(null)} />
    </div>
  )
}
