import { sql } from "drizzle-orm"
import { db } from "@/db"

/** A picture is only deleted once it is this old: one just pasted may not be saved in its note yet. */
const GRACE_DAYS = 7

/**
 * Deletes the pictures no note mentions any more (free notes, journal days and trades), once they are older
 * than the grace period. The notes keep only the address of a picture, so a picture is in use when that
 * address appears in one of them. Called after a note is saved or deleted; a failure never blocks the save.
 */
export async function deleteUnusedNoteImages(): Promise<void> {
  try {
    await db.execute(sql`
      delete from note_images i
      where i.created_at < now() - make_interval(days => ${GRACE_DAYS})
        and not exists (select 1 from notes n where n.content like '%' || i.id::text || '%')
        and not exists (select 1 from day_notes d where d.note like '%' || i.id::text || '%')
        and not exists (select 1 from trades t where t.note like '%' || i.id::text || '%')
    `)
  } catch (error) {
    console.error("Could not clean up the note pictures", error)
  }
}
