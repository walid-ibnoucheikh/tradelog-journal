"use server"

import { requireAuth } from "@/lib/auth/auth"
import { eq } from "drizzle-orm"
import { afterWrite } from "@/db/cache"
import { db } from "@/db"
import { deleteUnusedNoteImages } from "@/db/note-images"
import { dayNotes } from "@/db/schema"
import { isRealDay } from "@/lib/day"
import { readNote } from "@/lib/note"

export interface DayNoteState {
  error?: string
  success?: string
}

export async function saveDayNote(
  day: string,
  _previous: DayNoteState,
  formData: FormData
): Promise<DayNoteState> {
  await requireAuth()
  if (!isRealDay(day)) return { error: "Invalid date." }
  const parsed = readNote(formData.get("note"))
  if ("error" in parsed) return { error: parsed.error }
  const note = parsed.note

  if (note) {
    await db
      .insert(dayNotes)
      .values({ day, note })
      .onConflictDoUpdate({ target: dayNotes.day, set: { note, updatedAt: new Date() } })
  } else {
    await db.delete(dayNotes).where(eq(dayNotes.day, day))
  }
  await deleteUnusedNoteImages()
  afterWrite()
  return { success: note ? "Note saved." : "Note deleted." }
}
