"use client"

import { Dialog } from "@base-ui/react/dialog"
import { CalendarDays, NotebookPen, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { useActionState, useEffect, useMemo, useState, type ReactNode } from "react"
import { saveDayNote, type DayNoteState } from "@/app/(app)/journal/actions"
import { Button } from "@/components/ui/button"
import { formatLongDay, formatUsd, pnlColor } from "@/lib/format"
import type { DaySummary } from "@/lib/journal"
import { MAX_NOTE_LENGTH, parseNote } from "@/lib/note"
import { cn } from "@/lib/utils"
import { DayStats } from "./day-stats"
import { DeleteNoteButton } from "./delete-note-button"
import { TemplatedNoteEditor } from "./templated-note-editor"

/** Its own component so the editor and the messages start fresh each time the window opens. */
function DayNoteForm({
  day,
  note,
  tradeList,
}: {
  day: DaySummary
  note: string | null
  tradeList: ReactNode
}) {
  const [state, action, pending] = useActionState<DayNoteState, FormData>(
    saveDayNote.bind(null, day.date),
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
    <form action={action} className="grid grid-cols-1 gap-4 p-5 [&>*]:min-w-0">
      <div className="rounded-lg border p-4">
        <DayStats day={day} />
      </div>
      <TemplatedNoteEditor
        key={cleared ? "cleared" : "saved"}
        kind="day"
        initial={initial}
        label={`Note for ${day.date}`}
        maxLength={MAX_NOTE_LENGTH}
        onChange={(json, length) => setDraft({ json, length })}
      />
      {/* Nothing typed yet: send the saved note back unchanged (plain-text notes become rich ones). */}
      <input type="hidden" name="note" value={draft?.json ?? JSON.stringify(initial)} />
      {/* Delete on the left, away from the main action; the message and Save note on the right. */}
      <div className="flex flex-wrap items-center gap-3">
        {hasSavedNote && (
          <DeleteNoteButton
            kind="day"
            id={day.date}
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

      {/* The day's trades, read-only: a click on one opens its page, where its own note lives. */}
      <section aria-label="Trades of the day" className="grid grid-cols-1 gap-2">
        <h3 className="text-sm font-semibold">Trades ({day.trades})</h3>
        {tradeList}
      </section>
    </form>
  )
}

/** The note of a day in a window over the page: its figures, the editor, then its trades. */
export function DayNoteDialog({
  day,
  note,
  tradeList,
}: {
  day: DaySummary
  note: string | null
  /** The day's trades, rendered by the server page (a table, or cards on a phone). */
  tradeList: ReactNode
}) {
  const [open, setOpen] = useState(false)

  // A link ending in `#note-<date>` (the Dashboard calendar) opens this day's window straight away.
  useEffect(() => {
    if (window.location.hash !== `#note-${day.date}`) return
    const frame = requestAnimationFrame(() => setOpen(true))
    return () => cancelAnimationFrame(frame)
  }, [day.date])

  function onOpenChange(next: boolean) {
    setOpen(next)
    if (next || !window.location.hash.startsWith("#note-")) return
    // Closed: the address no longer asks for the window (a reload must not reopen it), and the
    // page shows that day's card behind it.
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}#day-${day.date}`
    )
    document.getElementById(`day-${day.date}`)?.scrollIntoView({ block: "start" })
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Trigger
        render={<Button variant={note ? "default" : "outline"} className="ml-auto" />}
      >
        <NotebookPen />
        {note ? "View note" : "Add note"}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
        <Dialog.Popup
          // A tap must not put the cursor in the first field: the iPhone keyboard would open at once and
          // push the window out of the screen. With a mouse or the keyboard the first field keeps the focus.
          initialFocus={(type) => type !== "touch"}
          className="fixed top-1/2 left-1/2 z-50 max-h-[90dvh] w-[min(56rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto overscroll-contain rounded-xl border bg-card text-card-foreground shadow-xl outline-none max-sm:top-3 max-sm:left-4 max-sm:max-h-[calc(100dvh-1.5rem)] max-sm:translate-none"
        >
          <div className="flex items-center gap-3 border-b px-5 py-4">
            <CalendarDays className="size-5 text-muted-foreground" />
            <Dialog.Title className="text-base font-semibold first-letter:uppercase">
              {formatLongDay(day.date)}
            </Dialog.Title>
            <p className="text-sm text-muted-foreground">
              Net P&amp;L{" "}
              <span className={cn("font-semibold", pnlColor(day.netPnl))}>
                {formatUsd(day.netPnl)}
              </span>
            </p>
            <Dialog.Close
              aria-label="Close"
              className="ml-auto inline-flex size-8 items-center justify-center rounded hover:bg-muted"
            >
              <X className="size-4" />
            </Dialog.Close>
          </div>

          <DayNoteForm day={day} note={note} tradeList={tradeList} />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
