import { describe, expect, it } from "vitest"
import { isRealDay, today } from "./day"

describe("today", () => {
  it("follows the timezone, not the server clock", () => {
    const now = new Date("2026-10-26T22:40:00Z")
    expect(today("America/New_York", now)).toBe("2026-10-26")
    expect(today("Europe/Paris", now)).toBe("2026-10-26")
    expect(today("Europe/Paris", new Date("2026-10-26T23:40:00Z"))).toBe("2026-10-27")
  })
})

describe("isRealDay", () => {
  it("accepts real days and rejects impossible or malformed ones", () => {
    expect(isRealDay("2026-10-27")).toBe(true)
    expect(isRealDay("2028-02-29")).toBe(true)
    expect(isRealDay("2026-02-29")).toBe(false)
    expect(isRealDay("2026-13-01")).toBe(false)
    expect(isRealDay("2026-1-1")).toBe(false)
    expect(isRealDay("")).toBe(false)
  })
})
