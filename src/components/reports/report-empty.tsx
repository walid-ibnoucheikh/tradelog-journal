import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"

/** Shown instead of a report when no trade matches the filters. */
export function ReportEmpty({ hasAccounts }: { hasAccounts: boolean }) {
  return (
    <div className="rounded-xl border bg-card p-10 text-center">
      <p className="font-medium">
        {hasAccounts ? "No trades for this selection." : "No accounts yet."}
      </p>
      <p className="mb-4 text-sm text-muted-foreground">
        {hasAccounts
          ? "Change the period or the account, or import new trades."
          : "Create an account, then import your Fills file from Tradovate."}
      </p>
      <Link href={hasAccounts ? "/import" : "/accounts"} className={buttonVariants()}>
        {hasAccounts ? "Import trades" : "Create an account"}
      </Link>
    </div>
  )
}
