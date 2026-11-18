/**
 * A copy of the note being typed, kept on this device until the server has it. If the page closes or the phone
 * goes to sleep before the save went through, the next opening of the note finds the copy and sends it.
 */
export interface NoteDraft {
  json: string
  title: string
  folderId: string | null
  /** When it was typed (ms). */
  at: number
}

export const draftKey = (kind: string, id: string) => `tradelog.draft.${kind}.${id}`

/** The draft stored as text, or null when there is none or it is not one of ours. */
export function parseDraft(text: string | null): NoteDraft | null {
  if (!text) return null
  try {
    const value = JSON.parse(text) as Partial<NoteDraft>
    if (
      typeof value.json === "string" &&
      typeof value.title === "string" &&
      typeof value.at === "number" &&
      (value.folderId === null || typeof value.folderId === "string")
    ) {
      return { json: value.json, title: value.title, folderId: value.folderId, at: value.at }
    }
  } catch {
    // Not JSON: ignore it.
  }
  return null
}

/** Whether a draft holds something the saved note does not: typed after the last save, and different. */
export function draftIsNewer(
  draft: NoteDraft,
  saved: { content: string; title: string; folderId: string | null; updatedAt: string }
): boolean {
  if (draft.at <= Date.parse(saved.updatedAt)) return false
  return (
    draft.json !== saved.content || draft.title !== saved.title || draft.folderId !== saved.folderId
  )
}
