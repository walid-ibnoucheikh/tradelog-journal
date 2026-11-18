"use server"

import { requireAuth } from "@/lib/auth/auth"
import { eq } from "drizzle-orm"
import { afterWrite } from "@/db/cache"
import { db } from "@/db"
import { deleteUnusedNoteImages } from "@/db/note-images"
import { trades } from "@/db/schema"
import { readNote } from "@/lib/note"
import { UUID_PATTERN } from "@/lib/trading/trade"

export interface NoteFormState {
  error?: string
  success?: string
}

export async function saveNote(
  tradeId: string,
  _previous: NoteFormState,
  formData: FormData
): Promise<NoteFormState> {
  await requireAuth()
  if (!UUID_PATTERN.test(tradeId)) return { error: "Trade not found." }
  const parsed = readNote(formData.get("note"))
  if ("error" in parsed) return { error: parsed.error }
  const note = parsed.note

  const updated = await db
    .update(trades)
    .set({ note: note || null })
    .where(eq(trades.id, tradeId))
    .returning({ id: trades.id })
  if (updated.length === 0) return { error: "Trade not found." }

  await deleteUnusedNoteImages()
  afterWrite()
  return { success: note ? "Note saved." : "Note deleted." }
}

const OVERRIDES = { auto: null, be: true, not_be: false } as const

/** Set Walid's break-even call on a trade: follow the rule (auto), force it, or rule it out. */
export async function setBreakEven(tradeId: string, formData: FormData) {
  await requireAuth()
  const mode = formData.get("mode")
  if (!UUID_PATTERN.test(tradeId) || typeof mode !== "string" || !(mode in OVERRIDES)) return

  await db
    .update(trades)
    .set({ breakEvenOverride: OVERRIDES[mode as keyof typeof OVERRIDES] })
    .where(eq(trades.id, tradeId))
  afterWrite()
}
