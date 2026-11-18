"use client"

import { useActionState, useEffect, useState } from "react"
import { useModalClose } from "@/components/modal"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { deleteAccount, updateAccount, type AccountFormState } from "./actions"
import { AccountFields } from "./account-fields"

export interface EditableAccount {
  id: string
  name: string
  firm: string
  tradovateName: string
  type: string
  initialBalance: number
}

export interface AccountContents {
  trades: number
  fills: number
  fees: number
  transactions: number
}

const plural = (count: number, word: string) => `${count} ${word}${count > 1 ? "s" : ""}`

function DeleteAccount({
  account,
  contents,
}: {
  account: EditableAccount
  contents: AccountContents
}) {
  const [state, action, pending] = useActionState<AccountFormState, FormData>(
    deleteAccount.bind(null, account.id),
    {}
  )
  const [typed, setTyped] = useState("")
  const matches = typed.trim() === account.name

  return (
    <form action={action} className="grid gap-3 rounded-lg border border-destructive/40 p-4">
      <h3 className="text-sm font-semibold text-destructive">Delete this account</h3>
      <p className="text-sm text-muted-foreground">
        Permanently deletes the account with its {plural(contents.trades, "trade")},{" "}
        {plural(contents.fills, "execution")} and {plural(contents.fees, "fee line")}. The notes and
        break-even choices of these trades are lost. You will have to recreate the account and
        re-import the Tradovate files to get the trades back.
        {contents.transactions > 0 &&
          ` The ${plural(contents.transactions, "transaction")} in the investment registry stay, with no account attached.`}
      </p>
      <label className="grid gap-1.5 text-sm font-medium">
        To confirm, type the account name: <span className="font-mono">{account.name}</span>
        <Input
          name="confirmName"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          autoComplete="off"
        />
      </label>
      <div className="flex items-center gap-3">
        <Button type="submit" variant="destructive" disabled={!matches || pending}>
          {pending ? "Deleting…" : "Delete permanently"}
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

/** Edit the identity of an account, with the deletion at the bottom. */
export function EditAccountForm({
  account,
  contents,
}: {
  account: EditableAccount
  contents: AccountContents
}) {
  const [state, action, pending] = useActionState<AccountFormState, FormData>(
    updateAccount.bind(null, account.id),
    {}
  )
  const close = useModalClose()
  useEffect(() => {
    if (state.success) close()
  }, [state.success, close])
  // After an error React resets the form, so show what was typed instead of the saved values.
  const values = state.values ?? {
    name: account.name,
    firm: account.firm,
    tradovateName: account.tradovateName,
    type: account.type,
    initialBalance: String(account.initialBalance),
  }

  return (
    <div className="grid gap-6">
      <form action={action} className="grid items-start gap-4 sm:grid-cols-2">
        <AccountFields values={values} />
        <div className="flex items-center gap-3 sm:col-span-2">
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
      <DeleteAccount account={account} contents={contents} />
    </div>
  )
}
