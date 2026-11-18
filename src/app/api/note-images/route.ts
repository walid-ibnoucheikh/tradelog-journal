import { db } from "@/db"
import { noteImages } from "@/db/schema"
import { isAuthenticated } from "@/lib/auth/auth"
import { MAX_IMAGE_BYTES, detectImageMime } from "@/lib/note-images"

/** Saves a picture pasted into a note (already compressed by the browser) and answers with its address. */
export async function POST(request: Request) {
  if (!(await isAuthenticated())) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const declared = Number(request.headers.get("content-length") ?? 0)
  if (declared > MAX_IMAGE_BYTES)
    return Response.json({ error: "Image too large." }, { status: 413 })

  const bytes = new Uint8Array(await request.arrayBuffer())
  if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) {
    return Response.json({ error: "Image too large." }, { status: 413 })
  }
  const mime = detectImageMime(bytes)
  if (!mime) return Response.json({ error: "Only PNG, JPEG and WebP pictures." }, { status: 415 })

  const [row] = await db
    .insert(noteImages)
    .values({ mime, data: Buffer.from(bytes).toString("base64"), size: bytes.length })
    .returning({ id: noteImages.id })
  return Response.json({ url: `/api/note-images/${row.id}` })
}
