import { describe, expect, it } from "vitest"
import { accountLoginKey, extraLoginKey, firmKey, loginBelongsTo } from "./firm-key"

describe("firmKey", () => {
  it.each([
    ["Lucid", "lucid"],
    [" LUCID ", "lucid"],
    ["Apex Trader Funding", "apex-trader-funding"],
    ["Top-Step!", "top-step"],
  ])("%s -> %s", (firm, key) => {
    expect(firmKey(firm)).toBe(key)
  })

  it("is empty for a name without letters or digits", () => {
    expect(firmKey("--")).toBe("")
  })
})

describe("extraLoginKey", () => {
  it("is tied to the firm and the username, whatever its case or spaces", () => {
    expect(extraLoginKey("Apex", "Walid@Mail.com ")).toBe(extraLoginKey(" apex", "walid@mail.com"))
    expect(extraLoginKey("Apex", "a")).not.toBe(extraLoginKey("Apex", "b"))
    expect(extraLoginKey("Apex", "a")).not.toBe(extraLoginKey("Lucid", "a"))
  })

  it("never shows the username", () => {
    expect(extraLoginKey("Apex", "walid@mail.com")).toMatch(/^apex:[0-9a-f]{8}$/)
  })
})

describe("loginBelongsTo", () => {
  it("matches the default and additional logins of the firm only", () => {
    expect(loginBelongsTo("apex", "Apex ")).toBe(true)
    expect(loginBelongsTo("apex:1a2b3c4d", "Apex")).toBe(true)
    expect(loginBelongsTo("apex-two", "Apex")).toBe(false)
    expect(loginBelongsTo("lucid", "Apex")).toBe(false)
  })
})

describe("accountLoginKey", () => {
  it("uses the account's own login, else the one of its firm", () => {
    expect(accountLoginKey({ firm: "Apex", loginKey: "apex:1a2b3c4d" })).toBe("apex:1a2b3c4d")
    expect(accountLoginKey({ firm: "Apex ", loginKey: null })).toBe("apex")
    expect(accountLoginKey({ firm: "Apex" })).toBe("apex")
    expect(accountLoginKey({ firm: "Apex", loginKey: "" })).toBe("apex")
  })
})
