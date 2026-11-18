import { randomBytes } from "node:crypto"
import { describe, expect, it } from "vitest"
import { decryptLogin, encryptLogin, loadCredentialsKey } from "./crypto"

const key = randomBytes(32)
const login = { username: "walid.apex", password: "p@ss word/é" }

describe("loadCredentialsKey", () => {
  it("reads 32 bytes of base64", () => {
    expect(loadCredentialsKey({ CREDENTIALS_KEY: key.toString("base64") })?.equals(key)).toBe(true)
  })

  it.each([undefined, "", "   ", "short", randomBytes(16).toString("base64")])(
    "refuses a missing or wrong key (%s)",
    (value) => {
      expect(loadCredentialsKey({ CREDENTIALS_KEY: value })).toBeNull()
    }
  )
})

describe("encryptLogin / decryptLogin", () => {
  it("gives the login back", () => {
    expect(decryptLogin(encryptLogin(login, "apex", key), "apex", key)).toEqual(login)
  })

  it("never writes the login in clear", () => {
    const secret = encryptLogin(login, "apex", key)
    expect(secret).not.toContain("walid")
    expect(secret).not.toContain("p@ss")
  })

  it("encrypts the same login differently each time", () => {
    expect(encryptLogin(login, "apex", key)).not.toBe(encryptLogin(login, "apex", key))
  })

  it("does not open with another key", () => {
    expect(decryptLogin(encryptLogin(login, "apex", key), "apex", randomBytes(32))).toBeNull()
  })

  it("does not open for another prop firm (a secret moved to another row)", () => {
    expect(decryptLogin(encryptLogin(login, "apex", key), "lucid", key)).toBeNull()
  })

  it("refuses a tampered or malformed secret", () => {
    const secret = encryptLogin(login, "apex", key)
    const [version, iv, tag, data] = secret.split(".")
    const flipped = Buffer.from(data, "base64")
    flipped[0] ^= 1
    expect(
      decryptLogin([version, iv, tag, flipped.toString("base64")].join("."), "apex", key)
    ).toBeNull()
    expect(decryptLogin("not a secret", "apex", key)).toBeNull()
    expect(decryptLogin("v2.a.b.c", "apex", key)).toBeNull()
    expect(decryptLogin("", "apex", key)).toBeNull()
  })
})
