/**
 * Longest side kept: a 4K screenshot stays sharp (and a retina one is not halved). Only a picture bigger than
 * this is scaled down; a normal screenshot keeps its exact pixels.
 */
const MAX_SIDE = 3000
/** What the server accepts (see `MAX_IMAGE_BYTES`), with some room. */
const TARGET_BYTES = 3.5 * 1024 * 1024

const encode = (canvas: HTMLCanvasElement, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality))

/**
 * Re-encodes a picture as WebP in the browser: near-lossless first (quality 0.95, no visible loss on charts and
 * text), then lower quality and finally a smaller size only if the file is still too big to send.
 */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  let scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  try {
    for (let attempt = 0; attempt < 4; attempt++) {
      const canvas = document.createElement("canvas")
      canvas.width = Math.max(1, Math.round(bitmap.width * scale))
      canvas.height = Math.max(1, Math.round(bitmap.height * scale))
      const context = canvas.getContext("2d")
      if (!context) throw new Error("This picture could not be read.")
      context.imageSmoothingQuality = "high"
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      for (const quality of [0.95, 0.85, 0.75]) {
        const blob = await encode(canvas, quality)
        if (!blob) throw new Error("This picture could not be read.")
        if (blob.size <= TARGET_BYTES) return blob
      }
      scale *= 0.75
    }
    throw new Error("This picture is too large.")
  } finally {
    bitmap.close()
  }
}

/** Sends a picture to `/api/note-images` and returns the address to put in the note. */
export async function uploadNoteImage(file: File): Promise<string> {
  const blob = await shrink(file)
  const response = await fetch("/api/note-images", {
    method: "POST",
    headers: { "Content-Type": blob.type },
    body: blob,
  })
  const body = (await response.json().catch(() => ({}))) as { url?: string; error?: string }
  if (!response.ok || !body.url) throw new Error(body.error ?? "The picture could not be saved.")
  return body.url
}

/** The pictures among some files (a paste, a drop or a file picker). */
export function imageFiles(files: Iterable<File> | null | undefined): File[] {
  return [...(files ?? [])].filter((file) => file.type.startsWith("image/"))
}

/**
 * The pictures of a paste or a drop. Reads `files` first, then the `items` list: some sources (a screenshot
 * tool, "Copy image" in a browser) only show their picture there.
 */
export function imagesOfTransfer(transfer: DataTransfer | null | undefined): File[] {
  if (!transfer) return []
  const fromFiles = imageFiles(transfer.files)
  if (fromFiles.length > 0) return fromFiles
  return [...transfer.items]
    .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
    .map((item) => item.getAsFile())
    .filter((file): file is File => file !== null)
}
