"use server"

import { eq } from "drizzle-orm"
import { afterWrite } from "@/db/cache"
import { db } from "@/db"
import { deleteUnusedNoteImages } from "@/db/note-images"
import { dayNotes, noteFolders, notes, trades } from "@/db/schema"
import { requireAuth } from "@/lib/auth/auth"
import { isRealDay } from "@/lib/day"
import { readNote } from "@/lib/note"
import { UUID_PATTERN } from "@/lib/trading/trade"

export interface NotebookResult {
  error?: string
  /** Id of what was created. */
  id?: string
}

const MAX_TITLE = 120
const MAX_FOLDER_NAME = 40

function folderName(value: string) {
  const name = value.trim()
  if (!name || name.length > MAX_FOLDER_NAME) return null
  return name
}

export async function createFolder(name: string): Promise<NotebookResult> {
  await requireAuth()
  const clean = folderName(name)
  if (!clean) return { error: `A folder name is 1 to ${MAX_FOLDER_NAME} characters.` }
  const [row] = await db
    .insert(noteFolders)
    .values({ name: clean })
    .returning({ id: noteFolders.id })
  afterWrite()
  return { id: row.id }
}

export async function renameFolder(id: string, name: string): Promise<NotebookResult> {
  await requireAuth()
  const clean = folderName(name)
  if (!clean) return { error: `A folder name is 1 to ${MAX_FOLDER_NAME} characters.` }
  if (!UUID_PATTERN.test(id)) return { error: "Folder not found." }
  await db.update(noteFolders).set({ name: clean }).where(eq(noteFolders.id, id))
  afterWrite()
  return {}
}

/** Deletes a folder; its notes are kept and go back to "My notes". */
export async function deleteFolder(id: string): Promise<NotebookResult> {
  await requireAuth()
  if (!UUID_PATTERN.test(id)) return { error: "Folder not found." }
  await db.delete(noteFolders).where(eq(noteFolders.id, id))
  afterWrite()
  return {}
}

/** Creates an empty note, or one that starts from a template (its title and its document). */
export async function createNote(
  folderId: string | null,
  template?: { title: string; content: string }
): Promise<NotebookResult> {
  await requireAuth()
  if (folderId !== null && !UUID_PATTERN.test(folderId)) return { error: "Folder not found." }
  const parsed = template ? readNote(template.content) : { note: "" }
  if ("error" in parsed) return { error: parsed.error }
  const [row] = await db
    .insert(notes)
    .values({
      folderId,
      title: (template?.title ?? "").trim().slice(0, MAX_TITLE),
      content: parsed.note,
    })
    .returning({ id: notes.id })
  afterWrite()
  return { id: row.id }
}

export async function deleteNote(id: string): Promise<NotebookResult> {
  await requireAuth()
  if (!UUID_PATTERN.test(id)) return { error: "Note not found." }
  await db.delete(notes).where(eq(notes.id, id))
  await deleteUnusedNoteImages()
  afterWrite()
  return {}
}

/**
 * Deletes a note of any kind. A free note disappears; the note of a journal day or of a trade is cleared (the
 * day and the trade stay). The pictures nothing mentions any more go with it.
 */
export async function removeNote(
  kind: "free" | "day" | "trade",
  id: string
): Promise<NotebookResult> {
  await requireAuth()
  if (kind === "free") {
    if (!UUID_PATTERN.test(id)) return { error: "Note not found." }
    await db.delete(notes).where(eq(notes.id, id))
  } else if (kind === "day") {
    if (!isRealDay(id)) return { error: "Invalid date." }
    await db.delete(dayNotes).where(eq(dayNotes.day, id))
  } else {
    if (!UUID_PATTERN.test(id)) return { error: "Trade not found." }
    await db.update(trades).set({ note: null }).where(eq(trades.id, id))
  }
  await deleteUnusedNoteImages()
  afterWrite()
  return {}
}

/** Saves a note, whatever it is: a free note, the note of a journal day or the note of a trade. */
export async function saveNotebookNote(input: {
  kind: "free" | "day" | "trade"
  id: string
  content: string
  title?: string
  folderId?: string | null
}): Promise<NotebookResult> {
  await requireAuth()
  const parsed = readNote(input.content)
  if ("error" in parsed) return { error: parsed.error }
  const note = parsed.note

  if (input.kind === "free") {
    if (!UUID_PATTERN.test(input.id)) return { error: "Note not found." }
    const title = (input.title ?? "").trim().slice(0, MAX_TITLE)
    const folderId = input.folderId ?? null
    if (folderId !== null && !UUID_PATTERN.test(folderId)) return { error: "Folder not found." }
    const updated = await db
      .update(notes)
      .set({ title, content: note, folderId, updatedAt: new Date() })
      .where(eq(notes.id, input.id))
      .returning({ id: notes.id })
    if (updated.length === 0) return { error: "Note not found." }
  } else if (input.kind === "day") {
    if (!isRealDay(input.id)) return { error: "Invalid date." }
    if (note) {
      await db
        .insert(dayNotes)
        .values({ day: input.id, note })
        .onConflictDoUpdate({ target: dayNotes.day, set: { note, updatedAt: new Date() } })
    } else {
      await db.delete(dayNotes).where(eq(dayNotes.day, input.id))
    }
  } else {
    if (!UUID_PATTERN.test(input.id)) return { error: "Trade not found." }
    const updated = await db
      .update(trades)
      .set({ note: note || null })
      .where(eq(trades.id, input.id))
      .returning({ id: trades.id })
    if (updated.length === 0) return { error: "Trade not found." }
  }
  await deleteUnusedNoteImages()
  afterWrite()
  return {}
}
