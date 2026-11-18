"use client"

import { useRouter } from "next/navigation"
import { useActionState, useMemo, useState } from "react"
import { DeleteNoteButton } from "@/components/journal/delete-note-button"
import { TemplatedNoteEditor } from "@/components/journal/templated-note-editor"
import { Button } from "@/components/ui/button"
import { MAX_NOTE_LENGTH, parseNote } from "@/lib/note"
import { saveNote, type NoteFormState } from "./actions"

/** Note of a trade, in the same rich editor as the journal (pictures included). */
export function NoteForm({ tradeId, note }: { tradeId: string; note: string | null }) {
  const [state, action, pending] = useActionState<NoteFormState, FormData>(
    saveNote.bind(null, tradeId),
    {}
  )
  const router = useRouter()
  // After a deletion the editor starts again empty, whatever the page has not reloaded yet.
  const [cleared, setCleared] = useState(false)
  const initial = useMemo(() => parseNote(cleared ? null : note), [note, cleared])
  const hasSavedNote = !cleared && note !== null && note.trim() !== ""
  const [draft, setDraft] = useState<{ json: string; length: number } | null>(null)
  const tooLong = (draft?.length ?? 0) > MAX_NOTE_LENGTH

  return (
    <form action={action} className="grid grid-cols-1 gap-3 [&>*]:min-w-0">
      <TemplatedNoteEditor
        key={cleared ? "cleared" : "saved"}
        kind="trade"
        initial={initial}
        label="Trade note"
        maxLength={MAX_NOTE_LENGTH}
        onChange={(json, length) => setDraft({ json, length })}
      />
      {/* Nothing typed yet: send the saved note back unchanged (a plain-text note becomes a rich one). */}
      <input type="hidden" name="note" value={draft?.json ?? JSON.stringify(initial)} />
      {/* Delete on the left, away from the main action; the message and Save note on the right. */}
      <div className="flex flex-wrap items-center gap-3">
        {hasSavedNote && (
          <DeleteNoteButton
            kind="trade"
            id={tradeId}
            onDeleted={() => {
              setCleared(true)
              setDraft(null)
              router.refresh()
            }}
          />
        )}
        <div className="ml-auto flex items-center gap-3 max-sm:w-full max-sm:flex-wrap">
          {state.error && (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          )}
          {state.success && (
            <p aria-live="polite" className="text-sm text-emerald-600 dark:text-emerald-400">
              {state.success}
            </p>
          )}
          <Button type="submit" disabled={pending || tooLong} className="max-sm:w-full">
            {pending ? "Saving…" : "Save note"}
          </Button>
        </div>
      </div>
    </form>
  )
}
