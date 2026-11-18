"use client"

import { Popover } from "@base-ui/react/popover"
import { Check, ChevronDown, ChevronRight, Search } from "lucide-react"
import { useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import {
  accountDetails,
  matchAccounts,
  sizeLabel,
  splitByState,
  type PickerAccount,
} from "@/lib/account-picker"
import { accountsInScope, ACCOUNT_SCOPES, type AccountScope } from "@/lib/filters"
import { cn } from "@/lib/utils"

const isScope = (value: string): value is AccountScope =>
  ACCOUNT_SCOPES.some((scope) => scope.value === value)

/**
 * Account filter that stays usable with dozens of accounts: a search box, the groups (all, active, funded,
 * evaluation) on top, the active accounts, and the blown and closed ones folded away until needed.
 * `value` is "" for the page's default group (`defaultScope`), a group name, or an account id.
 */
export function AccountPicker({
  accounts,
  value,
  defaultScope,
  onChange,
}: {
  accounts: PickerAccount[]
  value: string
  /** The group shown while `value` is "": the active accounts on the Dashboard, every account elsewhere. */
  defaultScope: AccountScope
  onChange: (value: string) => void
}) {
  const [query, setQuery] = useState("")
  const [endedOpen, setEndedOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const selected = accounts.find((account) => account.id === value) ?? null
  const scope = value === "" ? defaultScope : isScope(value) ? value : null
  const label = selected
    ? `${selected.name} · ${sizeLabel(selected)}`
    : (ACCOUNT_SCOPES.find((option) => option.value === scope)?.label ?? "All accounts")

  const found = matchAccounts(accounts, query)
  const { active, ended } = splitByState(found)
  const searching = query.trim() !== ""
  const showEnded = endedOpen || searching || (selected !== null && selected.status !== "active")

  const row = (account: PickerAccount) => (
    <li key={account.id}>
      <Popover.Close
        onClick={() => onChange(account.id)}
        aria-current={value === account.id ? "true" : undefined}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-muted",
          value === account.id && "bg-primary/10"
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{account.name}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {accountDetails(account)}
          </span>
        </span>
        {value === account.id && <Check className="size-4 shrink-0 text-primary" />}
      </Popover.Close>
    </li>
  )

  return (
    <Popover.Root
      onOpenChange={(open) => {
        if (open) setQuery("")
      }}
    >
      <Popover.Trigger
        aria-label="Account"
        // A purple outline reminds you the figures are for one account or one group, not for every account.
        className={cn(
          "inline-flex h-9 max-w-64 items-center gap-2 rounded-lg border bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          value !== "" && "border-primary ring-1 ring-primary/30"
        )}
      >
        <span className="truncate">{label}</span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner align="end" sideOffset={6} className="z-50">
          <Popover.Popup
            // With a mouse the cursor goes to the search box. On a phone it must not: the keyboard would open
            // at once and push the list out of the screen; tap the box to search.
            initialFocus={(type) => (type === "touch" ? false : searchRef.current)}
            className="flex max-h-[min(28rem,70dvh)] w-[22rem] max-w-[calc(100vw-2rem)] flex-col rounded-xl border bg-popover shadow-xl outline-none"
          >
            <div className="relative border-b p-2">
              <Search className="pointer-events-none absolute top-1/2 left-4.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchRef}
                aria-label="Search accounts"
                placeholder="Search by name, firm, size…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-9 pl-8"
              />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
              {!searching && (
                <ul className="mb-1.5 border-b pb-1.5">
                  {ACCOUNT_SCOPES.map((option) => {
                    const isDefault = option.value === defaultScope
                    const current = isDefault
                      ? value === "" || value === option.value
                      : value === option.value
                    const total = accountsInScope(accounts, option.value).length
                    return (
                      <li key={option.value}>
                        <Popover.Close
                          onClick={() => onChange(isDefault ? "" : option.value)}
                          aria-current={current ? "true" : undefined}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-muted",
                            current && "bg-primary/10 font-medium"
                          )}
                        >
                          <span className="min-w-0 flex-1 truncate">{option.label}</span>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {total}
                          </span>
                          {current && <Check className="size-4 shrink-0 text-primary" />}
                        </Popover.Close>
                      </li>
                    )
                  })}
                </ul>
              )}

              {active.length > 0 && (
                <>
                  <p className="px-2.5 pt-1 pb-1 text-xs font-medium text-muted-foreground">
                    Active · {active.length}
                  </p>
                  <ul>{active.map(row)}</ul>
                </>
              )}

              {ended.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => setEndedOpen(!showEnded)}
                    aria-expanded={showEnded}
                    className="mt-1 flex w-full items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
                  >
                    <ChevronRight
                      className={cn("size-3.5 transition-transform", showEnded && "rotate-90")}
                    />
                    Blown and closed · {ended.length}
                  </button>
                  {showEnded && <ul>{ended.map(row)}</ul>}
                </>
              )}

              {found.length === 0 && (
                <p className="p-4 text-center text-sm text-muted-foreground">
                  No account matches “{query}”.
                </p>
              )}
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
