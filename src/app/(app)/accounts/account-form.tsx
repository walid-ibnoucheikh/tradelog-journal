"use client"

import { useActionState, useEffect, useState } from "react"
import { useModalClose } from "@/components/modal"
import { Button } from "@/components/ui/button"
import { USER_TIMEZONE, today } from "@/lib/day"
import { createAccount, type AccountFormState } from "./actions"
import { AccountFields } from "./account-fields"
import { PurchaseFields } from "./purchase-fields"
import { RulesFields } from "./rules-fields"

/** Form to create an account, shown in a window; closes itself once the account exists. */
export function AccountForm() {
  const [state, action, pending] = useActionState<AccountFormState, FormData>(createAccount, {})
  const close = useModalClose()
  useEffect(() => {
    if (state.success) close()
  }, [state.success, close])
  // React resets the form after every submit; on an error, show what was typed again.
  const v = state.values ?? {}
  // The window only mounts when opened, in the browser: the date is the viewer's today.
  const [day] = useState(() => today(USER_TIMEZONE))

  return (
    <form action={action} className="grid items-start gap-4 sm:grid-cols-2">
      <AccountFields values={v} />
      <PurchaseFields values={v} today={day} />
      <p className="text-sm font-medium sm:col-span-2">Prop firm rules (optional)</p>
      <RulesFields values={v} />

      <div className="flex items-center gap-3 sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create account"}
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
