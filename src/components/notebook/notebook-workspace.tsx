"use client"

import { Popover } from "@base-ui/react/popover"
import {
  CalendarDays,
  CandlestickChart,
  Check,
  ChevronDown,
  ChevronLeft,
  FilePlus2,
  Files,
  Folder,
  FolderPlus,
  NotebookPen,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Search,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react"
import { useSearchParams } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import { createFolder, createNote, deleteFolder, renameFolder } from "@/app/(app)/notebook/actions"
import { Input } from "@/components/ui/input"
import { templatesFor, type NoteTemplate } from "@/lib/note-templates"
import {
  FOLDER_ALL,
  FOLDER_JOURNAL,
  FOLDER_MINE,
  FOLDER_TRADES,
  groupByRecency,
  itemsOfFolder,
  searchItems,
  type NotebookFolder,
  type NotebookItem,
} from "@/lib/notebook"
import { cn } from "@/lib/utils"
import { NotePane } from "./note-pane"

const BUILT_IN: { id: string; name: string; icon: LucideIcon }[] = [
  { id: FOLDER_ALL, name: "All notes", icon: Files },
  { id: FOLDER_JOURNAL, name: "Daily Journal", icon: CalendarDays },
  { id: FOLDER_TRADES, name: "Trade notes", icon: CandlestickChart },
  { id: FOLDER_MINE, name: "My notes", icon: NotebookPen },
]

/** One line under the folder name, to say what kind of note it holds. */
const FOLDER_HINTS: Record<string, string> = {
  [FOLDER_ALL]: "Every note: journal days, trades and your own.",
  [FOLDER_JOURNAL]: "Written on a day, from the Daily Journal.",
  [FOLDER_TRADES]: "Written on a trade, from its page.",
  [FOLDER_MINE]: "Your own notes, not tied to a day or a trade.",
}

const when = (iso: string) => {
  const date = new Date(iso)
  const today = new Date()
  return date.toDateString() === today.toDateString()
    ? date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString("en-GB", { month: "short", day: "numeric" })
}

/** Notebook: folders on the left, the notes of the folder in the middle, the open note as a page on the right. */
export function NotebookWorkspace({
  folders,
  items,
}: {
  folders: NotebookFolder[]
  items: NotebookItem[]
}) {
  // The folder and the open note live in the address (?folder=…&note=…): the back button and the swipe back of
  // a phone close the note and go back to the list, a reload comes back to the same note, a note has a link.
  const params = useSearchParams()
  const folder = params.get("folder") ?? FOLDER_ALL
  const selected = params.get("note")
  // True once opening the note added an entry to the history: closing it is then simply going back.
  const pushed = useRef(false)
  const [query, setQuery] = useState("")
  const [railOpen, setRailOpen] = useState(true)
  const [adding, setAdding] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [name, setName] = useState("")
  const [message, setMessage] = useState<string | null>(null)

  const groups = useMemo(
    () => groupByRecency(searchItems(itemsOfFolder(items, folder), query)),
    [items, folder, query]
  )
  const count = groups.reduce((sum, group) => sum + group.items.length, 0)
  const open = items.find((item) => item.key === selected) ?? null
  const phoneNoteOpen = open !== null
  const customFolder = folders.find((entry) => entry.id === folder) ?? null
  const currentName =
    BUILT_IN.find((entry) => entry.id === folder)?.name ?? customFolder?.name ?? "Notes"

  function go(next: { folder?: string | null; note?: string | null }, push = false) {
    const nextParams = new URLSearchParams(params.toString())
    for (const [key, value] of Object.entries(next)) {
      if (value) nextParams.set(key, value)
      else nextParams.delete(key)
    }
    const url = `${window.location.pathname}${nextParams.size ? `?${nextParams}` : ""}`
    if (push) window.history.pushState(null, "", url)
    else window.history.replaceState(null, "", url)
    pushed.current = push
  }

  const setFolder = (id: string) => go({ folder: id === FOLDER_ALL ? null : id })
  const openNote = (key: string) => go({ note: key }, true)
  /** Back to the list: on a phone the note was a step forward, so going back is the same as the back button. */
  function closeNote() {
    if (pushed.current) window.history.back()
    else go({ note: null })
  }

  // The last note is remembered; on a computer (three panes) the Notebook opens on it again.
  useEffect(() => {
    try {
      if (selected) localStorage.setItem("tradelog.notebook.last", selected)
      else if (!params.get("note") && !params.get("folder")) {
        const last = localStorage.getItem("tradelog.notebook.last")
        if (
          last &&
          matchMedia("(min-width: 1024px)").matches &&
          items.some((i) => i.key === last)
        ) {
          window.history.replaceState(
            null,
            "",
            `${window.location.pathname}?note=${encodeURIComponent(last)}`
          )
        }
      }
    } catch {
      // Storage blocked: the Notebook just opens on the list.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function addFolder() {
    const result = await createFolder(name)
    if (result.error) return setMessage(result.error)
    setAdding(false)
    setName("")
    setMessage(null)
    if (result.id) setFolder(result.id)
  }

  async function rename() {
    if (!customFolder) return
    const result = await renameFolder(customFolder.id, name)
    if (result.error) return setMessage(result.error)
    setRenaming(false)
    setMessage(null)
  }

  async function removeFolder() {
    if (!customFolder) return
    await deleteFolder(customFolder.id)
    setConfirmDelete(false)
    setFolder(FOLDER_ALL)
  }

  async function newNote(template?: NoteTemplate) {
    const result = await createNote(
      customFolder ? customFolder.id : null,
      template ? { title: template.title, content: JSON.stringify(template.doc) } : undefined
    )
    if (result.error) return setMessage(result.error)
    if (result.id) {
      setQuery("")
      openNote(`free:${result.id}`)
    }
  }

  const folderButton = (id: string, label: string, Icon: LucideIcon) => {
    const total = itemsOfFolder(items, id).length
    return (
      <button
        key={id}
        type="button"
        onClick={() => {
          setFolder(id)
          setRenaming(false)
          setConfirmDelete(false)
        }}
        title={label}
        aria-current={folder === id ? "true" : undefined}
        className={cn(
          "flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-sm transition-colors hover:bg-muted",
          folder === id && "bg-primary/10 font-medium text-primary"
        )}
      >
        <Icon className="size-4 shrink-0" />
        {railOpen && (
          <>
            <span className="min-w-0 flex-1 truncate">{label}</span>
            <span className="text-xs text-muted-foreground tabular-nums">{total}</span>
          </>
        )}
      </button>
    )
  }

  return (
    <div
      className={cn(
        "grid gap-3 transition-[grid-template-columns] duration-300 lg:h-[calc(100vh-9rem)]",
        railOpen
          ? "lg:grid-cols-[13rem_20rem_minmax(0,1fr)]"
          : "lg:grid-cols-[3.75rem_20rem_minmax(0,1fr)]"
      )}
    >
      {/* Folders (on a phone they are the chips at the top of the list) */}
      <section className="flex flex-col gap-0.5 overflow-x-hidden overflow-y-auto rounded-xl border bg-card p-2 max-lg:hidden">
        <div
          className={cn(
            "mb-1 flex items-center",
            railOpen ? "justify-between pl-2.5" : "justify-center"
          )}
        >
          {railOpen && <h2 className="text-sm font-semibold">Folders</h2>}
          <button
            type="button"
            aria-label={railOpen ? "Collapse folders" : "Expand folders"}
            title={railOpen ? "Collapse folders" : "Expand folders"}
            onClick={() => setRailOpen(!railOpen)}
            className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {railOpen ? (
              <PanelLeftClose className="size-4" />
            ) : (
              <PanelLeftOpen className="size-4" />
            )}
          </button>
        </div>
        {BUILT_IN.map((entry) => folderButton(entry.id, entry.name, entry.icon))}
        {folders.length > 0 && <div className="my-1.5 border-t" />}
        {folders.map((entry) => folderButton(entry.id, entry.name, Folder))}
        {railOpen && (
          <>
            {adding ? (
              <form
                className="mt-1 flex items-center gap-1"
                onSubmit={(event) => {
                  event.preventDefault()
                  void addFolder()
                }}
              >
                <Input
                  autoFocus
                  aria-label="Folder name"
                  placeholder="Folder name"
                  value={name}
                  maxLength={40}
                  onChange={(event) => setName(event.target.value)}
                  className="h-8"
                />
                <button
                  type="submit"
                  aria-label="Create folder"
                  className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg hover:bg-muted"
                >
                  <Check className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label="Cancel"
                  onClick={() => setAdding(false)}
                  className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg hover:bg-muted"
                >
                  <X className="size-4" />
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setAdding(true)
                  setName("")
                }}
                className="mt-1 flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <FolderPlus className="size-4" /> New folder
              </button>
            )}
            {message && (
              <p role="alert" className="px-2.5 text-xs text-destructive">
                {message}
              </p>
            )}
            {customFolder && (
              <div className="mt-2 border-t pt-2">
                {renaming ? (
                  <form
                    className="flex items-center gap-1"
                    onSubmit={(event) => {
                      event.preventDefault()
                      void rename()
                    }}
                  >
                    <Input
                      aria-label="New folder name"
                      value={name}
                      maxLength={40}
                      onChange={(event) => setName(event.target.value)}
                      className="h-8"
                    />
                    <button
                      type="submit"
                      aria-label="Save name"
                      className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg hover:bg-muted"
                    >
                      <Check className="size-4" />
                    </button>
                  </form>
                ) : confirmDelete ? (
                  <p className="px-1 text-xs">
                    Delete this folder? Its notes move to My notes.
                    <span className="mt-1.5 flex gap-1">
                      <button
                        type="button"
                        onClick={() => void removeFolder()}
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
                  </p>
                ) : (
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setRenaming(true)
                        setName(customFolder.name)
                      }}
                      className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg text-xs hover:bg-muted"
                    >
                      <Pencil className="size-3.5" /> Rename
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(true)}
                      className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg text-xs hover:bg-muted hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" /> Delete
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </section>

      {/* Notes of the folder */}
      <section
        className={cn(
          "flex min-h-72 flex-col overflow-hidden rounded-xl border bg-card",
          phoneNoteOpen && "max-lg:hidden"
        )}
      >
        <div className="space-y-2 border-b p-3">
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] lg:hidden [&::-webkit-scrollbar]:hidden">
            {[...BUILT_IN, ...folders.map((entry) => ({ id: entry.id, name: entry.name }))].map(
              (entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => {
                    setFolder(entry.id)
                    setRenaming(false)
                    setConfirmDelete(false)
                  }}
                  aria-current={folder === entry.id ? "true" : undefined}
                  className={cn(
                    "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm",
                    folder === entry.id
                      ? "border-primary bg-primary/10 font-medium text-primary"
                      : "text-muted-foreground"
                  )}
                >
                  {entry.name}
                  <span className="text-xs tabular-nums">
                    {itemsOfFolder(items, entry.id).length}
                  </span>
                </button>
              )
            )}
            <button
              type="button"
              onClick={() => {
                setAdding(true)
                setName("")
              }}
              aria-label="New folder"
              className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-dashed px-3.5 text-sm text-muted-foreground"
            >
              <FolderPlus className="size-4" /> Folder
            </button>
          </div>
          {adding && (
            <form
              className="flex items-center gap-1 lg:hidden"
              onSubmit={(event) => {
                event.preventDefault()
                void addFolder()
              }}
            >
              <Input
                aria-label="Folder name"
                placeholder="Folder name"
                value={name}
                maxLength={40}
                onChange={(event) => setName(event.target.value)}
                className="h-10"
              />
              <button
                type="submit"
                aria-label="Create folder"
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg hover:bg-muted"
              >
                <Check className="size-4" />
              </button>
              <button
                type="button"
                aria-label="Cancel"
                onClick={() => setAdding(false)}
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg hover:bg-muted"
              >
                <X className="size-4" />
              </button>
            </form>
          )}
          {customFolder && (
            <div className="flex items-center gap-2 text-xs lg:hidden">
              {confirmDelete ? (
                <>
                  <span>Delete this folder? Its notes move to My notes.</span>
                  <button
                    type="button"
                    onClick={() => void removeFolder()}
                    className="rounded px-2 py-2 font-medium text-destructive"
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="rounded px-2 py-2"
                  >
                    Keep
                  </button>
                </>
              ) : renaming ? (
                <form
                  className="flex flex-1 items-center gap-1"
                  onSubmit={(event) => {
                    event.preventDefault()
                    void rename()
                  }}
                >
                  <Input
                    aria-label="New folder name"
                    value={name}
                    maxLength={40}
                    onChange={(event) => setName(event.target.value)}
                    className="h-10"
                  />
                  <button
                    type="submit"
                    aria-label="Save name"
                    className="inline-flex size-10 items-center justify-center rounded-lg hover:bg-muted"
                  >
                    <Check className="size-4" />
                  </button>
                </form>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setRenaming(true)
                      setName(customFolder.name)
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg px-2 py-2 text-muted-foreground"
                  >
                    <Pencil className="size-3.5" /> Rename folder
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg px-2 py-2 text-muted-foreground"
                  >
                    <Trash2 className="size-3.5" /> Delete folder
                  </button>
                </>
              )}
            </div>
          )}
          <div>
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="truncate text-base font-semibold">{currentName}</h2>
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {count} note{count === 1 ? "" : "s"}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {FOLDER_HINTS[folder] ?? "Your own notes in this folder."}
            </p>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Search notes"
              placeholder="Search notes"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-9 pl-8"
            />
          </div>
          <div className="flex">
            <button
              type="button"
              onClick={() => void newNote()}
              className="flex h-9 flex-1 items-center justify-center gap-2 rounded-l-lg bg-primary text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              <FilePlus2 className="size-4" /> New note
            </button>
            <Popover.Root>
              <Popover.Trigger
                aria-label="New note from a template"
                title="New note from a template"
                className="inline-flex h-9 w-9 items-center justify-center rounded-r-lg border-l border-primary-foreground/25 bg-primary text-primary-foreground hover:opacity-90"
              >
                <ChevronDown className="size-4" />
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Positioner align="end" sideOffset={6} className="z-50">
                  <Popover.Popup className="w-72 rounded-xl border bg-popover p-1.5 shadow-xl outline-none">
                    <p className="px-2.5 py-1.5 text-xs text-muted-foreground">
                      Start from a template
                    </p>
                    {templatesFor("free").map((template) => (
                      <Popover.Close
                        key={template.id}
                        onClick={() => void newNote(template)}
                        className="block w-full rounded-lg px-2.5 py-2 text-left hover:bg-muted"
                      >
                        <span className="block text-sm font-medium">{template.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {template.description}
                        </span>
                      </Popover.Close>
                    ))}
                  </Popover.Popup>
                </Popover.Positioner>
              </Popover.Portal>
            </Popover.Root>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {count === 0 && (
            <p className="p-6 text-center text-sm text-muted-foreground">
              {query
                ? "No note matches your search."
                : "No notes here yet. Start one with the button above."}
            </p>
          )}
          {groups.map((group) => (
            <div key={group.label}>
              <h3 className="sticky top-0 z-[1] bg-card/95 px-4 pt-3 pb-1 text-xs font-medium text-muted-foreground backdrop-blur">
                {group.label}
              </h3>
              <ul>
                {group.items.map((item) => (
                  <li key={item.key}>
                    <button
                      type="button"
                      onClick={() => openNote(item.key)}
                      aria-current={selected === item.key ? "true" : undefined}
                      className={cn(
                        "relative block w-full px-4 py-2.5 text-left transition-colors hover:bg-muted/60",
                        selected === item.key &&
                          "bg-primary/10 before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-primary"
                      )}
                    >
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-sm font-medium">
                          {item.title || "Untitled"}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {when(item.updatedAt)}
                        </span>
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {item.subtitle || (item.text ? "" : "No additional text")}
                      </span>
                      {item.text && (
                        <span className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                          {item.text}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Open note, as a page */}
      <section
        className={cn(
          "min-h-[28rem] overflow-hidden rounded-xl border bg-card max-lg:min-h-[75dvh]",
          !open && "max-lg:hidden"
        )}
      >
        {open ? (
          <div className="flex h-full min-h-0 flex-col">
            <div className="flex items-center border-b px-1 lg:hidden">
              <button
                type="button"
                onClick={closeNote}
                className="inline-flex h-11 items-center gap-0.5 rounded-lg pr-3 pl-1 text-sm font-medium text-primary"
              >
                <ChevronLeft className="size-5" /> Notes
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <NotePane key={open.key} item={open} folders={folders} onDeleted={closeNote} />
            </div>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-6 p-8 text-center">
            <div>
              <h2 className="text-lg font-semibold">Pick a note, or start a new one</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Type / in a note for headings, lists, code and pictures. Paste a screenshot to add
                it.
              </p>
            </div>
            <div className="grid w-full max-w-xl gap-2 sm:grid-cols-3">
              {templatesFor("free").map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => void newNote(template)}
                  className="rounded-xl border p-3 text-left transition-colors hover:border-primary/50 hover:bg-primary/5"
                >
                  <span className="block text-sm font-medium">{template.name}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {template.description}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
