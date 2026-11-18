/** Notebook: every note in one place. Journal and trade notes live in their own tables; free notes in `notes`. */

export const FOLDER_ALL = "all"
export const FOLDER_JOURNAL = "journal"
export const FOLDER_TRADES = "trades"
/** Free notes that belong to no folder. */
export const FOLDER_MINE = "mine"

export interface NotebookFolder {
  id: string
  name: string
}

export interface NotebookItem {
  /** Unique across kinds: "free:<uuid>", "day:<YYYY-MM-DD>" or "trade:<uuid>". */
  key: string
  kind: "free" | "day" | "trade"
  /** The uuid of the note or trade, or the day. */
  id: string
  title: string
  subtitle: string
  /** Where the day or trade itself is shown; null for a free note. */
  href: string | null
  updatedAt: string
  /** Tiptap JSON (or plain text for an old note), as stored. */
  content: string
  /** Plain text of the note, for the preview and the search. */
  text: string
  /** Folder of a free note; null for the others and for free notes outside any folder. */
  folderId: string | null
}

/** The items of a folder: a built-in one (all, journal, trades, mine) or a folder created by the user. */
export function itemsOfFolder(items: NotebookItem[], folder: string): NotebookItem[] {
  switch (folder) {
    case FOLDER_ALL:
      return items
    case FOLDER_JOURNAL:
      return items.filter((item) => item.kind === "day")
    case FOLDER_TRADES:
      return items.filter((item) => item.kind === "trade")
    case FOLDER_MINE:
      return items.filter((item) => item.kind === "free" && item.folderId === null)
    default:
      return items.filter((item) => item.kind === "free" && item.folderId === folder)
  }
}

/** Items whose title or text contains every word of the query, case and accents ignored. */
export function searchItems(items: NotebookItem[], query: string): NotebookItem[] {
  const fold = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  const words = fold(query).split(/\s+/).filter(Boolean)
  if (words.length === 0) return items
  return items.filter((item) => {
    const haystack = fold(`${item.title} ${item.subtitle} ${item.text}`)
    return words.every((word) => haystack.includes(word))
  })
}

/** Most recently edited first. */
export function newestFirst(items: NotebookItem[]): NotebookItem[] {
  return [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export interface NotebookGroup {
  label: string
  items: NotebookItem[]
}

/** Items grouped by how long ago they were edited (Today, Yesterday, …), the newest group first. */
export function groupByRecency(items: NotebookItem[], now = new Date()): NotebookGroup[] {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const DAY = 86_400_000
  const label = (iso: string) => {
    const edited = new Date(iso)
    const startOfEdited = new Date(
      edited.getFullYear(),
      edited.getMonth(),
      edited.getDate()
    ).getTime()
    const days = Math.round((startOfToday - startOfEdited) / DAY)
    if (days <= 0) return "Today"
    if (days === 1) return "Yesterday"
    if (days <= 7) return "Previous 7 days"
    if (days <= 30) return "Previous 30 days"
    return "Older"
  }
  const groups: NotebookGroup[] = []
  for (const item of newestFirst(items)) {
    const name = label(item.updatedAt)
    const last = groups[groups.length - 1]
    if (last && last.label === name) last.items.push(item)
    else groups.push({ label: name, items: [item] })
  }
  return groups
}
