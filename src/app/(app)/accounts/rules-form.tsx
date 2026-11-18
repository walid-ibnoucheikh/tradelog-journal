"use client"

import { useActionState, useEffect } from "react"
import { useModalClose } from "@/components/modal"
import { Button } from "@/components/ui/button"
import { updateRules, type AccountFormState } from "./actions"
import { RulesFields } from "./rules-fields"

export interface RulesValues {
  profitTarget: number | null
  maxDrawdown: number | null
  drawdownType: string
  drawdownLockLevel: number | null
  dailyLossLimit: number | null
  consistencyPercent: number | null
}

const text = (value: number | null) => (value === null ? "" : String(value))

/** Form for the rules of an account, shown in a window. */
export function RulesForm({ accountId, rules }: { accountId: string; rules: RulesValues }) {
  const [state, action, pending] = useActionState<AccountFormState, FormData>(
    updateRules.bind(null, accountId),
    {}
  )
  const close = useModalClose()
  useEffect(() => {
    if (state.success) close()
  }, [state.success, close])
  // After an error React resets the form, so show what was typed instead of the saved values.
  const values = state.values ?? {
    profitTarget: text(rules.profitTarget),
    maxDrawdown: text(rules.maxDrawdown),
    drawdownType: rules.drawdownType,
    drawdownLockLevel: text(rules.drawdownLockLevel),
    dailyLossLimit: text(rules.dailyLossLimit),
    consistencyPercent: text(rules.consistencyPercent),
  }

  return (
    <form action={action} className="grid items-start gap-4 sm:grid-cols-2">
      <RulesFields values={values} />
      <div className="flex items-center gap-3 sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save rules"}
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
