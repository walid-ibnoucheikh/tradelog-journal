"use client"

import { Check, ExternalLink, Loader2, Trash2 } from "lucide-react"
import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { NoteEditor } from "@/components/journal/note-editor"
import { removeNote, saveNotebookNote } from "@/app/(app)/notebook/actions"
import { draftIsNewer, draftKey, parseDraft, type NoteDraft } from "@/lib/note-draft"
import { MAX_NOTE_LENGTH, parseNote } from "@/lib/note"
import type { NotebookFolder, NotebookItem } from "@/lib/notebook"
import { cn } from "@/lib/utils"

const SAVE_DELAY = 900

type SaveState = "idle" | "unsaved" | "saving" | "saved" | "error"

/** What deleting each kind of note does, said before it is done. */
const DELETE_QUESTION = {
  free: "Delete this note?",
  day: "Delete this day's note? The day stays in the journal.",
  trade: "Delete this trade's note? The trade stays.",
} as const

/** The copy of this note kept on the device, if it holds something the server does not have. */
function recoverDraft(item: NotebookItem): NoteDraft | null {
  try {
    const draft = parseDraft(localStorage.getItem(draftKey(item.kind, item.id)))
    return draft && draftIsNewer(draft, item) ? draft : null
  } catch {
    return null
  }
}

/**
 * One note open as a page. Saves by itself a moment after the last change, when it is closed and when the
 * screen is left (the phone goes to sleep, another app comes up). A copy stays on the device until the server
 * has it, so a closed page or a lost connection does not lose what was typed.
 */
export function NotePane({
  item,
  folders,
  onDeleted,
}: {
  item: NotebookItem
  folders: NotebookFolder[]
  onDeleted: () => void
}) {
  // The pane is only mounted in the browser, once a note is chosen: the device copy can be read at once.
  const [recovered] = useState(() => recoverDraft(item))
  const initial = useMemo(
    () => parseNote(recovered ? recovered.json : item.content),
    [item.content, recovered]
  )
  const [title, setTitle] = useState(recovered ? recovered.title : item.title)
  const [folderId, setFolderId] = useState(recovered ? recovered.folderId : item.folderId)
  const [state, setState] = useState<SaveState>(recovered ? "unsaved" : "idle")
  const [message, setMessage] = useState(
    recovered ? "Recovered what you typed before leaving." : ""
  )
  const [confirmDelete, setConfirmDelete] = useState(false)

  // What the next save will send, kept outside the render so the delayed save sees the latest values.
  const latest = useRef({
    title: recovered ? recovered.title : item.title,
    folderId: recovered ? recovered.folderId : item.folderId,
    json: recovered ? recovered.json : item.content,
    length: 0,
  })
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const dirty = useRef(recovered !== null)
  const key = draftKey(item.kind, item.id)

  function keepCopy() {
    try {
      const copy: NoteDraft = { ...latest.current, at: Date.now() }
      localStorage.setItem(
        key,
        JSON.stringify({
          json: copy.json,
          title: copy.title,
          folderId: copy.folderId,
          at: copy.at,
        })
      )
    } catch {
      // Storage full or blocked: the server save is still on its way.
    }
  }

  function dropCopy() {
    try {
      localStorage.removeItem(key)
    } catch {
      // Nothing to drop.
    }
  }

  async function save() {
    if (!dirty.current) return
    dirty.current = false
    if (latest.current.length > MAX_NOTE_LENGTH) {
      setState("error")
      setMessage(`Too long: ${MAX_NOTE_LENGTH.toLocaleString("en-US")} characters at most.`)
      dirty.current = true
      return
    }
    setState("saving")
    const sent = latest.current
    let error: string | undefined
    try {
      error = (
        await saveNotebookNote({
          kind: item.kind,
          id: item.id,
          content: sent.json,
          title: sent.title,
          folderId: sent.folderId,
        })
      ).error
    } catch {
      error = "No connection. Your note is kept on this device."
    }
    if (error) {
      dirty.current = true
      setState("error")
      setMessage(error)
      return
    }
    // Something was typed while this was on its way: its own save follows.
    if (!dirty.current) dropCopy()
    setState(dirty.current ? "unsaved" : "saved")
    setMessage("")
  }

  function changed(next: Partial<typeof latest.current>) {
    latest.current = { ...latest.current, ...next }
    dirty.current = true
    keepCopy()
    setState("unsaved")
    clearTimeout(timer.current)
    timer.current = setTimeout(() => void save(), SAVE_DELAY)
  }

  // A note recovered from the device is sent shortly after it opens.
  useEffect(() => {
    if (recovered) timer.current = setTimeout(() => void save(), SAVE_DELAY)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Leaving the screen (phone asleep, another app, a closed tab) sends what was not saved yet at once.
  useEffect(() => {
    function leaving() {
      if (document.visibilityState === "hidden" && dirty.current) {
        clearTimeout(timer.current)
        void save()
      }
    }
    document.addEventListener("visibilitychange", leaving)
    window.addEventListener("pagehide", leaving)
    return () => {
      document.removeEventListener("visibilitychange", leaving)
      window.removeEventListener("pagehide", leaving)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Closing the note (another one is chosen) sends what was not saved yet.
  useEffect(() => {
    const pending = latest
    const dirtyFlag = dirty
    const delayed = timer
    return () => {
      clearTimeout(delayed.current)
      if (dirtyFlag.current && pending.current.length <= MAX_NOTE_LENGTH) {
        void saveNotebookNote({
          kind: item.kind,
          id: item.id,
          content: pending.current.json,
          title: pending.current.title,
          folderId: pending.current.folderId,
        })
          .then((result) => {
            if (!result.error) {
              try {
                localStorage.removeItem(draftKey(item.kind, item.id))
              } catch {
                // Nothing to drop.
              }
            }
          })
          .catch(() => {
            // The device copy stays: the note is recovered the next time it opens.
          })
      }
    }
  }, [item.kind, item.id])

  const free = item.kind === "free"
  const status =
    state === "error" ? (
      <span role="alert" className="inline-flex items-center gap-2 text-destructive">
        Not saved{message ? ` · ${message}` : ""}
        <button
          type="button"
          onClick={() => {
            dirty.current = true
            void save()
          }}
          className="rounded px-2 py-1 font-medium underline"
        >
          Retry
        </button>
      </span>
    ) : state === "saving" ? (
      <span className="inline-flex items-center gap-1.5">
        <Loader2 className="size-3.5 animate-spin" /> Saving…
      </span>
    ) : state === "saved" ? (
      <span className="inline-flex items-center gap-1.5">
        <Check className="size-3.5 text-profit-text" /> Saved
      </span>
    ) : state === "unsaved" ? (
      <span>{message || "Editing…"}</span>
    ) : (
      <span>
        Edited{" "}
        {new Date(item.updatedAt).toLocaleDateString("en-GB", { month: "short", day: "numeric" })}
      </span>
    )

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-2 text-xs text-muted-foreground sm:px-6">
        <span role="status" aria-live="polite" className="min-w-20">
          {status}
        </span>
        <span className="flex-1" />
        {item.href && (
          <Link
            href={item.href}
            className="inline-flex items-center gap-1 rounded px-1.5 py-1 hover:bg-muted hover:text-foreground"
          >
            {item.kind === "day" ? "Open in journal" : "Open trade"}
            <ExternalLink className="size-3.5" />
          </Link>
        )}
        {free && (
          <label className="flex items-center gap-1.5">
            <span className="sr-only">Folder</span>
            <select
              value={folderId ?? ""}
              onChange={(event) => {
                const next = event.target.value || null
                setFolderId(next)
                changed({ folderId: next })
              }}
              className="h-7 rounded-md border bg-transparent px-1.5 text-xs text-foreground"
            >
              <option value="">My notes</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {confirmDelete ? (
          <span className="flex flex-wrap items-center gap-1 text-foreground">
            {DELETE_QUESTION[item.kind]}
            <button
              type="button"
              onClick={async () => {
                clearTimeout(timer.current)
                dirty.current = false
                dropCopy()
                await removeNote(item.kind, item.id)
                onDeleted()
              }}
              className="rounded px-2 py-1 font-medium text-destructive hover:bg-destructive/10"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="rounded px-2 py-1 hover:bg-muted"
            >
              Keep
            </button>
          </span>
        ) : (
          <button
            type="button"
            aria-label="Delete note"
            title="Delete note"
            onClick={() => setConfirmDelete(true)}
            className="inline-flex size-7 items-center justify-center rounded hover:bg-muted hover:text-destructive"
          >
            <Trash2 className="size-4" />
          </button>
        )}
      </header>

      <div className="mx-auto w-full max-w-3xl px-4 pt-6 sm:px-10">
        {free ? (
          <input
            aria-label="Note title"
            placeholder="Untitled"
            value={title}
            maxLength={120}
            onChange={(event) => {
              setTitle(event.target.value)
              changed({ title: event.target.value })
            }}
            className="w-full bg-transparent text-3xl font-semibold tracking-tight outline-none placeholder:text-muted-foreground/50"
          />
        ) : (
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">{item.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{item.subtitle}</p>
          </div>
        )}
      </div>

      <div className={cn("min-h-0 flex-1 pt-2")}>
        <NoteEditor
          document
          initial={initial}
          label={free ? "Note" : item.title}
          maxLength={MAX_NOTE_LENGTH}
          onChange={(json, length) => changed({ json, length })}
        />
      </div>
    </div>
  )
}
