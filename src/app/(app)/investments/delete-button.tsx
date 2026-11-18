"use client"

import { Trash2 } from "lucide-react"
import { deleteTransaction } from "./actions"

export function DeleteTransactionButton({ id }: { id: string }) {
  return (
    <form
      action={deleteTransaction.bind(null, id)}
      onSubmit={(event) => {
        if (!window.confirm("Delete this transaction?")) event.preventDefault()
      }}
    >
      <button
        type="submit"
        aria-label="Delete transaction"
        className="inline-flex size-8 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-destructive"
      >
        <Trash2 className="size-4" />
      </button>
    </form>
  )
}
