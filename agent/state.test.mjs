import { describe, expect, it } from "vitest"
import {
  SECRET_LIMIT_BYTES,
  decodeState,
  describeExpiry,
  describeState,
  encodeState,
  expiryLines,
} from "./state.mjs"

const state = {
  cookies: [{ name: "a", value: "1", domain: "x.test", path: "/" }],
  origins: [{ origin: "https://x.test", localStorage: [{ name: "k", value: "v" }] }],
}

describe("browser state packing", () => {
  it("round-trips through one line of text", () => {
    const packed = encodeState(state)
    expect(packed).not.toMatch(/\s/)
    expect(decodeState(`${packed}\n`)).toEqual(state)
  })

  it("keeps a realistic state well under the secret limit once compressed", () => {
    const big = {
      cookies: [],
      origins: [
        {
          origin: "https://x.test",
          localStorage: Array.from({ length: 300 }, (_, i) => ({
            name: `item-${i}`,
            value: "value ".repeat(40),
          })),
        },
      ],
    }
    expect(encodeState(big).length).toBeLessThan(SECRET_LIMIT_BYTES)
  })

  it("rejects text that is not a state", () => {
    expect(() => decodeState("not base64 gzip")).toThrow()
    expect(() => decodeState(encodeState({ nothing: true }))).toThrow(/not a browser state/)
  })

  it("describes a state with counts only", () => {
    expect(describeState(state)).toEqual({ cookies: 1, origins: 1, storageItems: 1 })
  })

  it("spreads cookie expiry over time, naming only the short-lived ones, never a value", () => {
    const now = new Date("2026-11-04T00:00:00Z")
    const at = (iso) => new Date(iso).getTime() / 1000
    const cookies = [
      { name: "session", value: "SECRET1", expires: -1 },
      { name: "_gat", value: "SECRET2", expires: at("2026-11-04T00:01:00Z") },
      { name: "week", value: "SECRET3", expires: at("2026-11-09T00:00:00Z") },
      { name: "year", value: "SECRET4", expires: at("2027-11-04T00:00:00Z") },
    ]
    const state = { cookies, origins: [] }
    const { sessionOnly, persistent, spread } = describeExpiry(state, now)
    expect([sessionOnly, persistent]).toEqual([1, 3])
    expect(spread.map((bucket) => bucket.count)).toEqual([1, 1, 0, 0, 1])
    const text = expiryLines(state, now).join("\n")
    expect(text).toContain("under 1 day: 1 (_gat)")
    expect(text).toContain("1 to 7 days: 1 (week)")
    expect(text).toContain("over 90 days: 1")
    expect(text).not.toContain("year")
    expect(text).not.toContain("SECRET")
  })

  it("copes with a state without any dated cookie", () => {
    expect(describeExpiry({ cookies: [], origins: [] }).persistent).toBe(0)
    expect(expiryLines({ cookies: [], origins: [] })).toHaveLength(1)
  })
})
