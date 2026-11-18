"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { parsePnlMode, type PnlMode } from "@/lib/reports"
import { cn } from "@/lib/utils"

const options: { value: PnlMode; label: string }[] = [
  { value: "net", label: "Net P&L" },
  { value: "gross", label: "Gross P&L" },
]

/** Switches every figure of the report between the P&L after fees (net) and before (gross). */
export function PnlToggle() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const mode = parsePnlMode(params.get("pnl") ?? undefined)

  function choose(value: PnlMode) {
    const next = new URLSearchParams(params.toString())
    if (value === "net") next.delete("pnl")
    else next.set("pnl", value)
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false })
  }

  return (
    <div role="group" aria-label="P&L type" className="inline-flex rounded-lg border p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={mode === option.value}
          onClick={() => choose(option.value)}
          className={cn(
            "min-h-8 rounded-md px-3 text-sm transition-colors hover:bg-muted",
            mode === option.value &&
              "bg-primary font-medium text-primary-foreground hover:bg-primary/90"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
