/** Largest picture accepted (Vercel refuses a request body over 4.5 MB). The browser stays under it. */
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024

export type ImageMime = "image/webp" | "image/png" | "image/jpeg"

/** The kind of picture, read from the first bytes of the file (never from what the client claims). */
export function detectImageMime(bytes: Uint8Array): ImageMime | null {
  const startsWith = (...signature: number[]) => signature.every((byte, i) => bytes[i] === byte)
  if (startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png"
  if (startsWith(0xff, 0xd8, 0xff)) return "image/jpeg"
  // WebP: "RIFF", four size bytes, then "WEBP".
  if (
    startsWith(0x52, 0x49, 0x46, 0x46) &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp"
  }
  return null
}
