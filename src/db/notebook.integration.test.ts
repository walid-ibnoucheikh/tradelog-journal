/**
 * Runs the notebook queries and the picture routes against a Neon database. Needs TEST_DATABASE_URL
 * (a dedicated Neon branch) and is skipped without it. It never touches DATABASE_URL.
 */
import { eq, inArray, sql } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

// Outside Next there is no cache to drop and no session to check: these calls only matter in the running app.
vi.mock("next/cache", () => ({
  cacheLife: () => {},
  cacheTag: () => {},
  revalidateTag: () => {},
  updateTag: () => {},
  refresh: () => {},
}))
vi.mock("@/lib/auth/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/auth")>()),
  requireAuth: async () => {},
}))

try {
  process.loadEnvFile(".env.test.local")
} catch {
  // No local env file: rely on the process environment (CI).
}

const testUrl = process.env.TEST_DATABASE_URL
const hostOf = (url: string) => new URL(url).hostname

// A 1x1 transparent PNG.
const PNG = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
    "base64"
  )
)

describe.skipIf(!testUrl)("notebook (Neon test branch)", { timeout: 60_000 }, () => {
  let db: typeof import("@/db").db
  let schema: typeof import("@/db/schema")
  const created = { folder: "", note: "", image: "", cleanup: [] as string[] }

  beforeAll(async () => {
    if (process.env.DATABASE_URL && hostOf(process.env.DATABASE_URL) === hostOf(testUrl!)) {
      throw new Error("TEST_DATABASE_URL points at the same database as DATABASE_URL")
    }
    process.env.DATABASE_URL = testUrl
    ;({ db } = await import("@/db"))
    schema = await import("@/db/schema")
  })

  afterAll(async () => {
    if (created.note) await db.delete(schema.notes).where(eq(schema.notes.id, created.note))
    if (created.folder) {
      await db.delete(schema.noteFolders).where(eq(schema.noteFolders.id, created.folder))
    }
    const images = [created.image, ...created.cleanup].filter(Boolean)
    if (images.length) {
      await db.delete(schema.noteImages).where(inArray(schema.noteImages.id, images))
    }
  })

  it("lists a free note of a folder with its plain text", async () => {
    const [folder] = await db
      .insert(schema.noteFolders)
      .values({ name: "Test folder" })
      .returning({ id: schema.noteFolders.id })
    created.folder = folder.id
    const content = JSON.stringify({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Retest entry" }] }],
    })
    const [note] = await db
      .insert(schema.notes)
      .values({ title: "Setup", content, folderId: folder.id })
      .returning({ id: schema.notes.id })
    created.note = note.id

    const { getNotebook } = await import("@/db/notebook")
    const { folders, items } = await getNotebook()
    expect(folders.some((f) => f.id === folder.id)).toBe(true)
    const item = items.find((i) => i.key === `free:${note.id}`)
    expect(item).toMatchObject({
      kind: "free",
      title: "Setup",
      folderId: folder.id,
      text: "Retest entry",
    })
  })

  it("saves a picture, serves it back and refuses what is not a picture", async () => {
    const { POST } = await import("@/app/api/note-images/route")
    const { GET } = await import("@/app/api/note-images/[id]/route")

    const saved = await POST(
      new Request("http://localhost/api/note-images", { method: "POST", body: PNG })
    )
    expect(saved.status).toBe(200)
    const { url } = (await saved.json()) as { url: string }
    expect(url).toMatch(/^\/api\/note-images\/[0-9a-f-]{36}$/)
    created.image = url.split("/").pop()!

    const served = await GET(new Request(`http://localhost${url}`), {
      params: Promise.resolve({ id: created.image }),
    })
    expect(served.status).toBe(200)
    expect(served.headers.get("content-type")).toBe("image/png")
    expect(new Uint8Array(await served.arrayBuffer())).toEqual(PNG)

    const refused = await POST(
      new Request("http://localhost/api/note-images", {
        method: "POST",
        body: "<svg onload=alert(1)>",
      })
    )
    expect(refused.status).toBe(415)
  })

  it("deletes old pictures that no note mentions, and keeps the others", async () => {
    const { deleteUnusedNoteImages } = await import("@/db/note-images")
    const add = async (age: string) => {
      const [row] = await db
        .insert(schema.noteImages)
        .values({ mime: "image/png", data: "AA==", size: 1 })
        .returning({ id: schema.noteImages.id })
      await db.execute(
        sql`update note_images set created_at = now() - ${age}::interval where id = ${row.id}`
      )
      created.cleanup.push(row.id)
      return row.id
    }
    const orphan = await add("30 days")
    const used = await add("30 days")
    const fresh = await add("1 hour")
    await db
      .update(schema.notes)
      .set({ content: `{"src":"/api/note-images/${used}"}` })
      .where(eq(schema.notes.id, created.note))

    await deleteUnusedNoteImages()

    const left = await db
      .select({ id: schema.noteImages.id })
      .from(schema.noteImages)
      .where(inArray(schema.noteImages.id, [orphan, used, fresh]))
    expect(left.map((row) => row.id).sort()).toEqual([used, fresh].sort())
  })

  it("deletes a free note and clears a journal day's note, whatever the kind", async () => {
    const { removeNote } = await import("@/app/(app)/notebook/actions")
    const [free] = await db
      .insert(schema.notes)
      .values({ title: "To delete", content: "x" })
      .returning({ id: schema.notes.id })
    const day = "2001-01-02"
    await db.insert(schema.dayNotes).values({ day, note: "A day" }).onConflictDoNothing()

    expect(await removeNote("free", free.id)).toEqual({})
    expect(await removeNote("day", day)).toEqual({})
    expect(await db.select().from(schema.notes).where(eq(schema.notes.id, free.id))).toHaveLength(0)
    expect(
      await db.select().from(schema.dayNotes).where(eq(schema.dayNotes.day, day))
    ).toHaveLength(0)

    // Bad identifiers are refused, nothing is touched.
    expect(await removeNote("free", "nope")).toHaveProperty("error")
    expect(await removeNote("day", "not-a-day")).toHaveProperty("error")
    expect(await removeNote("trade", "nope")).toHaveProperty("error")
  })
})
