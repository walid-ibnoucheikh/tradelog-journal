"use client"

import { useActionState, useEffect } from "react"
import { Field, selectClass } from "@/components/form-field"
import { useModalClose } from "@/components/modal"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ACCOUNT_STATUSES, type AccountStatus } from "@/lib/investments/investments"
import { updateLifecycle, type AccountFormState } from "./actions"

/** Form for the status of an account (active, blown, closed) and its key dates, in a window. */
export function LifecycleForm({
  accountId,
  status,
  fundedAt,
  endedAt,
}: {
  accountId: string
  status: AccountStatus
  fundedAt: string | null
  endedAt: string | null
}) {
  const [state, action, pending] = useActionState<AccountFormState, FormData>(
    updateLifecycle.bind(null, accountId),
    {}
  )
  const close = useModalClose()
  useEffect(() => {
    if (state.success) close()
  }, [state.success, close])
  // React resets the form after every submit; on an error, show what was typed again.
  const v = state.values ?? {}

  return (
    <form action={action} className="grid gap-4">
      <Field label="Status">
        <select
          key={v.status}
          name="status"
          defaultValue={v.status ?? status}
          className={selectClass}
        >
          {ACCOUNT_STATUSES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Funded on" hint="Set when the evaluation is passed.">
        <Input name="fundedAt" type="date" defaultValue={v.fundedAt ?? fundedAt ?? ""} />
      </Field>
      <Field label="Blown / closed on" hint="Required if the account is no longer active.">
        <Input name="endedAt" type="date" defaultValue={v.endedAt ?? endedAt ?? ""} />
      </Field>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        {state.error && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}
      </div>
    </form>
  )
}
