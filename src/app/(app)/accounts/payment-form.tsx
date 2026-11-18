"use client"

import { useActionState, useEffect, useState } from "react"
import { Field, selectClass } from "@/components/form-field"
import { useModalClose } from "@/components/modal"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { USER_TIMEZONE, today } from "@/lib/day"
import { TRANSACTION_TYPES } from "@/lib/investments/investments"
import { ACCOUNT_PAYMENT_TYPES } from "@/lib/investments/purchase"
import { createTransaction, type TransactionFormState } from "../investments/actions"

/**
 * A payment on one account (a reset, the activation, a payout...). It goes to the same registry as
 * the Investments page, already linked to the account and its prop firm.
 */
export function PaymentForm({
  accountId,
  defaultType,
}: {
  accountId: string
  defaultType: (typeof ACCOUNT_PAYMENT_TYPES)[number]
}) {
  const [state, action, pending] = useActionState<TransactionFormState, FormData>(
    createTransaction,
    {}
  )
  const close = useModalClose()
  useEffect(() => {
    if (state.success) close()
  }, [state.success, close])
  const v = state.values ?? {}
  const [day] = useState(() => today(USER_TIMEZONE))

  return (
    <form action={action} className="grid items-start gap-4 sm:grid-cols-2">
      <input type="hidden" name="accountId" value={accountId} />
      <Field label="Type">
        <select
          key={v.type}
          name="type"
          defaultValue={v.type ?? defaultType}
          className={selectClass}
        >
          {ACCOUNT_PAYMENT_TYPES.map((value) => (
            <option key={value} value={value}>
              {TRANSACTION_TYPES.find((type) => type.value === value)?.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Date">
        <Input name="day" type="date" defaultValue={v.day ?? day} required />
      </Field>
      <Field label="Amount (USD)" hint="What you actually paid or received.">
        <Input
          name="amount"
          type="number"
          step="0.01"
          min="0.01"
          defaultValue={v.amount}
          required
        />
      </Field>
      <Field label="Note" hint="Optional: promo code, reason for the reset…">
        <Input name="note" maxLength={500} defaultValue={v.note} />
      </Field>
      <div className="flex items-center gap-3 sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add payment"}
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
