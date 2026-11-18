"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { selectClass } from "@/components/form-field"
import { periodLabel } from "@/lib/investments/period"

/** Period of the investments analysis: everything, the last 12 months or one year. */
export function PeriodSelect({ years }: { years: string[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  function choose(value: string) {
    const next = new URLSearchParams(params.toString())
    if (value === "all") next.delete("period")
    else next.set("period", value)
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false })
  }

  return (
    <select
      aria-label="Period"
      className={selectClass}
      value={params.get("period") ?? "all"}
      onChange={(event) => choose(event.target.value)}
    >
      <option value="all">{periodLabel("all")}</option>
      <option value="12m">{periodLabel("12m")}</option>
      {years.map((year) => (
        <option key={year} value={year}>
          {year}
        </option>
      ))}
    </select>
  )
}
