import { describe, expect, it } from "vitest"
import { detectImageMime } from "./note-images"

const bytes = (...values: number[]) => new Uint8Array([...values, 0, 0, 0, 0, 0, 0, 0, 0])

describe("detectImageMime", () => {
  it("recognises PNG, JPEG and WebP by their first bytes", () => {
    expect(detectImageMime(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("image/png")
    expect(detectImageMime(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg")
    expect(detectImageMime(bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50))).toBe(
      "image/webp"
    )
  })

  it("refuses anything else, whatever its name or type says", () => {
    expect(detectImageMime(new TextEncoder().encode("<svg onload=alert(1)></svg>"))).toBeNull()
    expect(detectImageMime(new TextEncoder().encode("GIF89a"))).toBeNull()
    expect(detectImageMime(new Uint8Array())).toBeNull()
  })
})
