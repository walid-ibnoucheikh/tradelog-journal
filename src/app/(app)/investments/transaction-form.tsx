"use client"

import { useActionState, useEffect, useState } from "react"
import { Field, selectClass } from "@/components/form-field"
import { useModalClose } from "@/components/modal"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  TRANSACTION_TYPES,
  isOutsidePropFirm,
  type TransactionType,
} from "@/lib/investments/investments"
import { createTransaction, type TransactionFormState } from "./actions"

export function TransactionForm({
  accounts,
  providers,
  today,
}: {
  accounts: { id: string; name: string; firm: string }[]
  /** Providers already used for spending outside prop firms, suggested again. */
  providers: string[]
  today: string
}) {
  const [state, action, pending] = useActionState<TransactionFormState, FormData>(
    createTransaction,
    {}
  )
  const [type, setType] = useState<TransactionType>("evaluation")
  const outside = isOutsidePropFirm(type)
  const close = useModalClose()
  useEffect(() => {
    if (state.success) close()
  }, [state.success, close])
  // React resets the form after every submit; on an error, show what was typed again.
  const v = state.values ?? {}

  return (
    <form action={action} className="grid items-start gap-4 sm:grid-cols-2">
      <Field label="Date">
        <Input name="day" type="date" defaultValue={v.day ?? today} required />
      </Field>
      <Field label="Type">
        <select
          name="type"
          value={type}
          onChange={(event) => setType(event.target.value as TransactionType)}
          className={selectClass}
        >
          <optgroup label="Prop firm">
            {TRANSACTION_TYPES.filter((option) => !isOutsidePropFirm(option.value)).map(
              (option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              )
            )}
          </optgroup>
          <optgroup label="Outside prop firms">
            {TRANSACTION_TYPES.filter((option) => isOutsidePropFirm(option.value)).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </optgroup>
        </select>
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
      {outside ? (
        <Field
          label="Provider"
          hint="Optional: TradingView, Tradecopia, the mentor or course name…"
        >
          <Input
            name="firm"
            list="tx-providers"
            defaultValue={v.firm}
            maxLength={60}
            placeholder="TradingView"
          />
          <datalist id="tx-providers">
            {providers.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </Field>
      ) : (
        <>
          <Field label="Account" hint="Optional. The prop firm is then taken from the account.">
            <select
              key={v.accountId}
              name="accountId"
              defaultValue={v.accountId ?? ""}
              className={selectClass}
            >
              <option value="">No specific account</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} ({account.firm})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Prop firm" hint="Only if no account is chosen.">
            <Input name="firm" list="tx-firms" defaultValue={v.firm} placeholder="Apex" />
            <datalist id="tx-firms">
              <option value="Apex" />
              <option value="Tradeify" />
              <option value="Lucid" />
            </datalist>
          </Field>
        </>
      )}
      <Field
        label="Note"
        hint={
          outside
            ? "Optional: this month's subscription, plan…"
            : "Optional: promo code, reason for the reset…"
        }
      >
        <Input name="note" maxLength={500} defaultValue={v.note} />
      </Field>

      <div className="flex items-center gap-3 sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add transaction"}
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
