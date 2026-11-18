import { eq } from "drizzle-orm"
import { db } from "@/db"
import { noteImages } from "@/db/schema"
import { isAuthenticated } from "@/lib/auth/auth"
import { UUID_PATTERN } from "@/lib/trading/trade"

/** Serves a picture of a note. The proxy already asks for the session; this checks it again. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthenticated())) return new Response("Unauthorized", { status: 401 })
  const { id } = await params
  if (!UUID_PATTERN.test(id)) return new Response("Not found", { status: 404 })

  const [image] = await db.select().from(noteImages).where(eq(noteImages.id, id))
  if (!image) return new Response("Not found", { status: 404 })

  return new Response(Buffer.from(image.data, "base64"), {
    headers: {
      "Content-Type": image.mime,
      // A picture never changes once saved: the browser may keep it.
      "Cache-Control": "private, max-age=31536000, immutable",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  })
}
