"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { selectClass } from "@/components/form-field"

/** Firm, account and year filters of the registry; they live in the address, like the other pages. */
export function RegistryFilters({
  firms,
  accounts,
  years,
}: {
  firms: { value: string; label: string }[]
  accounts: { id: string; name: string }[]
  years: string[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString())
    if (value === "all") next.delete(key)
    else next.set(key, value)
    next.delete("page")
    router.replace(`${pathname}?${next}`, { scroll: false })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label="Prop firm or provider"
        className={selectClass}
        value={params.get("firm") ?? "all"}
        onChange={(event) => update("firm", event.target.value)}
      >
        <option value="all">All firms and providers</option>
        {firms.map((firm) => (
          <option key={firm.value} value={firm.value}>
            {firm.label}
          </option>
        ))}
      </select>
      <select
        aria-label="Account"
        className={selectClass}
        value={params.get("account") ?? "all"}
        onChange={(event) => update("account", event.target.value)}
      >
        <option value="all">All accounts</option>
        {accounts.map((account) => (
          <option key={account.id} value={account.id}>
            {account.name}
          </option>
        ))}
      </select>
      <select
        aria-label="Year"
        className={selectClass}
        value={params.get("year") ?? "all"}
        onChange={(event) => update("year", event.target.value)}
      >
        <option value="all">All years</option>
        {years.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </select>
    </div>
  )
}
