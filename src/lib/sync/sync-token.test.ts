import { describe, expect, it } from "vitest"
import { checkSyncToken, isSyncRoute } from "./sync-token"

const token = "a".repeat(40)

describe("checkSyncToken", () => {
  it("accepts the right token", async () => {
    expect(await checkSyncToken(token, `Bearer ${token}`)).toBe("ok")
  })

  it("rejects a wrong, missing or malformed token", async () => {
    expect(await checkSyncToken(token, `Bearer ${"b".repeat(40)}`)).toBe("unauthorized")
    expect(await checkSyncToken(token, null)).toBe("unauthorized")
    expect(await checkSyncToken(token, token)).toBe("unauthorized")
    expect(await checkSyncToken(token, `Basic ${token}`)).toBe("unauthorized")
    expect(await checkSyncToken(token, `Bearer ${token.slice(0, -1)}`)).toBe("unauthorized")
  })

  it("is off when no token, or a short one, is configured", async () => {
    expect(await checkSyncToken(undefined, `Bearer ${token}`)).toBe("disabled")
    expect(await checkSyncToken("", "Bearer ")).toBe("disabled")
    expect(await checkSyncToken("short", "Bearer short")).toBe("disabled")
  })
})

describe("isSyncRoute", () => {
  it("matches only the agent's routes", () => {
    expect(isSyncRoute("/api/sync/next")).toBe(true)
    expect(isSyncRoute("/api/sync")).toBe(true)
    expect(isSyncRoute("/api/syncing")).toBe(false)
    expect(isSyncRoute("/api/note-images")).toBe(false)
    expect(isSyncRoute("/import")).toBe(false)
  })
})
