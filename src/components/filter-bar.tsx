"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useEffect } from "react"
import { AccountPicker } from "@/components/account-picker"
import { readAccount, rememberAccount } from "@/lib/account-memory"
import type { PickerAccount } from "@/lib/account-picker"
import { ACCOUNT_SCOPES, RANGES, defaultScopeFor } from "@/lib/filters"
import { STATUSES } from "@/lib/trading/trade"

const selectClass =
  "h-9 rounded-lg border bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"

export function FilterBar({
  accounts,
  statusFilter = false,
  rangeFilter = true,
}: {
  accounts: PickerAccount[]
  statusFilter?: boolean
  rangeFilter?: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  // What this page shows without an account in its address: the active accounts on the Dashboard, else all.
  const defaultScope = defaultScopeFor(pathname)

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString())
    // For the account, an empty value is the page's default; any other choice is kept in the address.
    if (value === "" || (key !== "account" && value === "all")) next.delete(key)
    else next.set(key, value)
    // The choice itself is remembered, so another page shows it too even when it is this page's default.
    if (key === "account") rememberAccount(value || defaultScope)
    next.delete("page")
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false })
  }

  // The account chosen on another page applies here too; one that no longer exists is forgotten.
  const urlAccount = params.get("account")
  const known = (id: string) =>
    ACCOUNT_SCOPES.some((scope) => scope.value === id) ||
    accounts.some((account) => account.id === id)
  useEffect(() => {
    const stored = readAccount()
    if (urlAccount !== null) {
      if (!known(urlAccount)) {
        rememberAccount(null)
        const next = new URLSearchParams(params.toString())
        next.delete("account")
        router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false })
      } else if (stored !== urlAccount) {
        rememberAccount(urlAccount)
      }
    } else if (stored) {
      if (stored === defaultScope) {
        // Already what this page shows: nothing to add to the address.
      } else if (known(stored)) {
        const next = new URLSearchParams(params.toString())
        next.set("account", stored)
        router.replace(`${pathname}?${next}`, { scroll: false })
      } else {
        rememberAccount(null)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlAccount, accounts, pathname])

  return (
    <div className="flex flex-wrap items-center gap-2">
      {rangeFilter && (
        <select
          aria-label="Period"
          className={selectClass}
          value={params.get("range") ?? "all"}
          onChange={(event) => update("range", event.target.value)}
        >
          {RANGES.map((range) => (
            <option key={range.value} value={range.value}>
              {range.label}
            </option>
          ))}
        </select>
      )}
      {statusFilter && (
        <select
          aria-label="Status"
          className={selectClass}
          value={params.get("status") ?? "all"}
          onChange={(event) => update("status", event.target.value)}
        >
          {STATUSES.map((status) => (
            <option key={status.value} value={status.value}>
              {status.label}
            </option>
          ))}
        </select>
      )}
      <AccountPicker
        accounts={accounts}
        value={urlAccount ?? ""}
        defaultScope={defaultScope}
        onChange={(value) => update("account", value)}
      />
    </div>
  )
}
