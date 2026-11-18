import { TriangleAlert } from "lucide-react"
import Link from "next/link"
import { InfoTip } from "@/components/info-tip"
import { summarizeImports } from "@/lib/accounts/import-freshness"
import { formatImportTime } from "@/lib/format"
import { cn } from "@/lib/utils"

/**
 * One quiet line on top of the dashboard: when the data was last imported, and a link to import.
 * It turns yellow when an account looks behind; for several accounts a bubble lists which ones.
 */
export function ImportStatus({
  accounts,
  now,
}: {
  accounts: { name: string; lastImportedAt: Date | null }[]
  now: Date
}) {
  const { oldest, late } = summarizeImports(accounts, now)
  const behind = late.length > 0

  return (
    <p
      className={cn(
        "flex flex-wrap items-center gap-x-2 gap-y-1 text-sm",
        behind ? "text-yellow-700 dark:text-yellow-400" : "text-muted-foreground"
      )}
    >
      {behind && <TriangleAlert className="size-4 shrink-0" aria-hidden />}
      <span>{oldest ? `Last import: ${formatImportTime(oldest)}` : "No imports yet"}</span>
      {behind && accounts.length > 1 && (
        <span className="flex items-center gap-1">
          · {late.length} account{late.length > 1 ? "s" : ""} late
          <InfoTip label="Late accounts">
            <ul className="space-y-0.5">
              {late.map((account) => (
                <li key={account.name}>
                  <span className="font-medium">{account.name}</span>: last import{" "}
                  {formatImportTime(account.lastImportedAt)}
                </li>
              ))}
            </ul>
          </InfoTip>
        </span>
      )}
      <Link href="/import" className="font-medium text-foreground underline underline-offset-2">
        Import
      </Link>
    </p>
  )
}
