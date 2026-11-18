import { describe, expect, it } from "vitest"
import {
  SESSION_DAYS,
  authStatus,
  createSessionToken,
  passwordMatches,
  safeNextPath,
  verifySessionToken,
} from "./auth-core"

const secret = "s".repeat(32)
const password = "correct horse battery"

describe("authStatus", () => {
  it("stays open locally when no password is set", () => {
    expect(authStatus({ NODE_ENV: "development" })).toEqual({ mode: "disabled" })
    expect(authStatus({})).toEqual({ mode: "disabled" })
  })

  it("locks production when the password is missing, short, or the secret is weak", () => {
    expect(authStatus({ NODE_ENV: "production" })).toMatchObject({ mode: "misconfigured" })
    expect(
      authStatus({ NODE_ENV: "production", APP_PASSWORD: "short", SESSION_SECRET: secret })
    ).toMatchObject({ mode: "misconfigured", reason: expect.stringContaining("APP_PASSWORD") })
    expect(
      authStatus({ NODE_ENV: "production", APP_PASSWORD: password, SESSION_SECRET: "abc" })
    ).toMatchObject({ mode: "misconfigured", reason: expect.stringContaining("SESSION_SECRET") })
  })

  it("also locks a local app whose password is set but badly configured", () => {
    expect(authStatus({ APP_PASSWORD: "short", SESSION_SECRET: secret }).mode).toBe("misconfigured")
  })

  it("is enabled with a long enough password and secret", () => {
    expect(
      authStatus({ NODE_ENV: "production", APP_PASSWORD: password, SESSION_SECRET: secret })
    ).toEqual({ mode: "enabled", password, secret })
  })
})

describe("session tokens", () => {
  const now = Date.UTC(2026, 9, 27)

  it("accepts a fresh token", async () => {
    expect(await verifySessionToken(secret, await createSessionToken(secret, now), now)).toBe(true)
  })

  it("expires after the session length", async () => {
    const token = await createSessionToken(secret, now)
    const justBefore = now + SESSION_DAYS * 86_400_000 - 1
    expect(await verifySessionToken(secret, token, justBefore)).toBe(true)
    expect(await verifySessionToken(secret, token, justBefore + 1)).toBe(false)
  })

  it("rejects a token signed with another secret", async () => {
    const token = await createSessionToken("x".repeat(32), now)
    expect(await verifySessionToken(secret, token, now)).toBe(false)
  })

  it("rejects a token whose expiry was extended", async () => {
    const [version, , signature] = (await createSessionToken(secret, now)).split(".")
    const forged = `${version}.${now + 10 * 365 * 86_400_000}.${signature}`
    expect(await verifySessionToken(secret, forged, now)).toBe(false)
  })

  it("rejects missing or malformed tokens", async () => {
    for (const token of [undefined, "", "abc", "v1.1.2.3", "v2.9999999999999.abcd", "v1.x.abcd"]) {
      expect(await verifySessionToken(secret, token, now)).toBe(false)
    }
    const valid = await createSessionToken(secret, now)
    expect(await verifySessionToken(secret, `${valid}zz`, now)).toBe(false)
    expect(await verifySessionToken(secret, valid.slice(0, -2), now)).toBe(false)
  })
})

describe("passwordMatches", () => {
  it("matches only the exact password", async () => {
    expect(await passwordMatches(password, password)).toBe(true)
    expect(await passwordMatches(`${password} `, password)).toBe(false)
    expect(await passwordMatches("", password)).toBe(false)
    expect(await passwordMatches(password.toUpperCase(), password)).toBe(false)
  })
})

describe("safeNextPath", () => {
  it("keeps paths of this app", () => {
    expect(safeNextPath("/trades")).toBe("/trades")
    expect(safeNextPath("/journal?month=2026-10")).toBe("/journal?month=2026-10")
  })

  it("refuses anything that could leave the site or loop", () => {
    for (const value of [
      undefined,
      "",
      "trades",
      "//evil.com",
      "https://evil.com",
      "/\\evil.com",
      "/login",
      "/login?next=/",
      "/a\nb",
    ]) {
      expect(safeNextPath(value)).toBe("/")
    }
  })
})
