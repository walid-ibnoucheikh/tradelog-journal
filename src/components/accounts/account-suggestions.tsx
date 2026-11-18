"use client"

import { markAccountEnded } from "@/app/(app)/accounts/actions"
import { Button } from "@/components/ui/button"
import { formatDay, formatUsd } from "@/lib/format"
import type { Suggestion } from "@/lib/accounts/suggestions"
import { FinalSyncButton } from "./final-sync-button"

function EndButton({
  suggestion,
  status,
  day,
}: {
  suggestion: Suggestion
  status: "blown" | "closed"
  day: string
}) {
  return (
    <form action={markAccountEnded}>
      <input type="hidden" name="accountId" value={suggestion.id} />
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="day" value={day} />
      <Button type="submit" size="sm" variant={status === "blown" ? "default" : "outline"}>
        Mark as {status}
      </Button>
    </form>
  )
}

/**
 * Active accounts that look finished, for the person to confirm: nothing changes until a button is
 * pressed. The end date is the day the account really ended, so the lifetime and ROI stay right.
 */
export function AccountSuggestions({ suggestions }: { suggestions: Suggestion[] }) {
  if (suggestions.length === 0) return null
  return (
    <section
      aria-label="Accounts to review"
      className="rounded-xl border border-yellow-500/40 bg-yellow-500/10 p-4"
    >
      <h2 className="text-base font-medium text-yellow-900 dark:text-yellow-200">
        {suggestions.length === 1
          ? "1 account to review"
          : `${suggestions.length} accounts to review`}
      </h2>
      <p className="text-sm text-muted-foreground">
        Sync an account one last time before marking it ended: Tradovate may remove it soon, and its
        last trades could not be recovered afterwards.
      </p>
      <ul className="mt-3 divide-y divide-yellow-500/20">
        {suggestions.map((item) => (
          <li key={item.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
            <div className="min-w-0 flex-1 basis-72">
              <p className="text-sm font-medium">
                {item.name} <span className="font-normal text-muted-foreground">· {item.firm}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                {item.kind === "blown" ? (
                  <>
                    Looks blown: the balance reached {formatUsd(item.balance)} (threshold{" "}
                    {formatUsd(item.threshold)}) on {formatDay(item.day)}, and nothing was traded
                    after.
                    {item.missing && " Tradovate no longer lists it."}
                  </>
                ) : (
                  <>Not found in Tradovate since {formatDay(item.since)}. Blown or closed?</>
                )}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <FinalSyncButton accountId={item.id} />
              <EndButton
                suggestion={item}
                status="blown"
                day={item.kind === "blown" ? item.day : (item.lastTradeDay ?? item.since)}
              />
              {item.kind === "missing" && (
                <EndButton
                  suggestion={item}
                  status="closed"
                  day={item.lastTradeDay ?? item.since}
                />
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
