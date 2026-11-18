import { ACCOUNT_STATUSES, type AccountStatus } from "@/lib/investments/investments"
import { cn } from "@/lib/utils"

const styles: Record<AccountStatus, string> = {
  active: "bg-muted text-foreground",
  blown: "bg-loss/15 text-loss-text",
  closed: "bg-be/15 text-be-text",
}

export function AccountStatusBadge({ status }: { status: AccountStatus }) {
  const label = ACCOUNT_STATUSES.find((option) => option.value === status)?.label
  return (
    <span className={cn("rounded px-2 py-0.5 text-xs font-semibold", styles[status])}>{label}</span>
  )
}
