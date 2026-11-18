"use client"

import { CircleCheck, Loader2, TriangleAlert } from "lucide-react"
import Link from "next/link"
import { startTransition, useActionState, useState } from "react"
import { FileDrop } from "@/components/file-drop"
import { TradovateDrop } from "@/components/tradovate-drop"
import { Button } from "@/components/ui/button"
import { importFillsAction, type ImportState } from "./actions"

function Figure({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

export function ImportForm() {
  const [state, action, pending] = useActionState<ImportState, FormData>(importFillsAction, {})
  const [fills, setFills] = useState<File | null>(null)
  const [cash, setCash] = useState<File | null>(null)

  // After an import the files are done with: clearing them avoids sending the same ones twice.
  // `round` remounts the drop zones, which also empties their hidden file inputs.
  const [round, setRound] = useState(0)
  const [lastSummary, setLastSummary] = useState(state.summary)
  if (state.summary !== lastSummary) {
    setLastSummary(state.summary)
    if (state.summary) {
      setFills(null)
      setCash(null)
      setRound(round + 1)
    }
  }

  const count = Number(fills !== null) + Number(cash !== null)

  return (
    <div className="space-y-6">
      <form
        onSubmit={(event) => {
          event.preventDefault()
          // Sent by hand so a failed import keeps the chosen files instead of resetting the form.
          // The files come from the state: they can have been chosen by the drop zone for both files.
          const data = new FormData(event.currentTarget)
          data.delete("fills")
          data.delete("cash")
          if (fills) data.set("fills", fills)
          if (cash) data.set("cash", cash)
          startTransition(() => action(data))
        }}
        className="space-y-5"
      >
        <TradovateDrop
          onFiles={(files) => {
            if (files.fills) setFills(files.fills)
            if (files.cash) setCash(files.cash)
          }}
        />
        <div className="grid gap-4 md:grid-cols-2">
          <FileDrop
            key={`fills-${round}`}
            name="fills"
            title="Fills.csv"
            description="The executions: this file provides the trades."
            badge="Essential"
            file={fills}
            onChange={setFills}
          />
          <FileDrop
            key={`cash-${round}`}
            name="cash"
            title="Cash History.csv"
            description="The real fees: commission, exchange, clearing, NFA."
            badge="Recommended"
            file={cash}
            onChange={setCash}
          />
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Button type="submit" size="lg" disabled={pending || count === 0}>
            {pending && <Loader2 className="animate-spin" />}
            {pending ? "Importing…" : "Import"}
          </Button>
          <p className="text-sm text-muted-foreground">
            {count === 0
              ? "Choose at least one file."
              : `${count} file${count > 1 ? "s" : ""} ready to import.`}
          </p>
        </div>
      </form>

      {state.error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
          <p>{state.error}</p>
        </div>
      )}

      {state.summary && (
        <div className="space-y-4 text-sm" aria-live="polite">
          {state.summary.imported.map((result) => (
            <div key={result.account} className="space-y-3 rounded-xl border p-4">
              <p className="font-medium">{result.account}</p>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Figure
                  value={
                    <>
                      {result.newFills}
                      <span className="text-sm font-normal text-muted-foreground">
                        {" "}
                        / {result.fillsInFile}
                      </span>
                    </>
                  }
                  label="executions added"
                />
                <Figure
                  value={
                    <>
                      {result.newFees}
                      <span className="text-sm font-normal text-muted-foreground">
                        {" "}
                        / {result.feesInFile}
                      </span>
                    </>
                  }
                  label="fee lines added"
                />
                <Figure value={result.trades} label="trades in total" />
                <Figure value={result.fillsTotal} label="executions in total" />
              </div>
              {result.fillsWithFees === result.fillsTotal && result.fillsTotal > 0 ? (
                <p className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <CircleCheck className="size-4 shrink-0" />
                  Real Tradovate fees applied to all executions.
                </p>
              ) : (
                <p className="flex items-start gap-2 text-amber-600 dark:text-amber-400">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                  <span>
                    Real fees applied to {result.fillsWithFees} execution(s) out of{" "}
                    {result.fillsTotal} : the others only count the commission. Import{" "}
                    <code>Cash History.csv</code> for the same period, or re-import{" "}
                    <code>Fills.csv</code> if it was imported before this feature.
                  </span>
                </p>
              )}
              {result.openContracts > 0 && (
                <p className="flex items-start gap-2 text-amber-600 dark:text-amber-400">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                  {result.openContracts} contract(s) still open: this position is not counted in the
                  trades until it is closed.
                </p>
              )}
            </div>
          ))}
          {state.summary.unknownAccounts.length > 0 && (
            <div className="rounded-xl border border-amber-500/50 bg-amber-500/5 p-4">
              <p className="font-medium">Unknown accounts, not imported:</p>
              <ul className="list-disc pl-5 font-mono">
                {state.summary.unknownAccounts.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
              <p className="mt-2 text-muted-foreground">
                Create them in{" "}
                <Link href="/accounts" className="underline">
                  Accounts
                </Link>{" "}
                with exactly that Tradovate name, then re-import the file.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
