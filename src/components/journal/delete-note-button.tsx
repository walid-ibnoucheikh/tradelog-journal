"use client"

import { Trash2 } from "lucide-react"
import { useState } from "react"
import { removeNote } from "@/app/(app)/notebook/actions"
import { Button } from "@/components/ui/button"

/** "Delete note" with its confirmation. Deleting a day's or a trade's note clears the note, never the day or the trade. */
export function DeleteNoteButton({
  kind,
  id,
  onDeleted,
}: {
  kind: "day" | "trade"
  id: string
  onDeleted: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!confirming) {
    return (
      <Button type="button" variant="ghost" onClick={() => setConfirming(true)}>
        <Trash2 /> Delete note
      </Button>
    )
  }
  return (
    <span className="flex flex-wrap items-center gap-2 text-sm">
      <span>
        {kind === "day"
          ? "Delete this day's note? The day stays."
          : "Delete this note? The trade stays."}
      </span>
      <Button
        type="button"
        variant="destructive"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          const result = await removeNote(kind, id)
          setBusy(false)
          if (result.error) return setError(result.error)
          setConfirming(false)
          onDeleted()
        }}
      >
        {busy ? "Deleting…" : "Delete"}
      </Button>
      <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>
        Keep
      </Button>
      {error && (
        <span role="alert" className="text-destructive">
          {error}
        </span>
      )}
    </span>
  )
}
