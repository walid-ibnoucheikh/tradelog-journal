import { describe, expect, it } from "vitest"
import { packCloudVault, openCloudVault } from "./cloud-vault.mjs"
import { parseExportArgs } from "./export-args.mjs"

describe("parseExportArgs", () => {
  it("reads the prop firms", () => {
    expect(parseExportArgs(["Tradeify", " Lucid "])).toEqual({
      firms: ["Tradeify", "Lucid"],
      noLogins: false,
    })
  })

  it("reads --no-logins wherever it is", () => {
    expect(parseExportArgs(["--no-logins", "Tradeify"]).noLogins).toBe(true)
    expect(parseExportArgs(["Tradeify", "--no-logins"])).toEqual({
      firms: ["Tradeify"],
      noLogins: true,
    })
  })

  it("refuses an option it does not know, so a typo never keeps the passwords by accident", () => {
    expect(() => parseExportArgs(["--no-login", "Tradeify"])).toThrow(/Unknown option/)
  })
})

describe("a vault packed without logins", () => {
  it("holds the browser states and no username or password", () => {
    const state = { cookies: [{ name: "a" }], origins: [] }
    const packed = packCloudVault([{ firm: "Tradeify", login: null, state }])
    expect(packed).not.toMatch(/password/i)
    const entry = openCloudVault(packed).get("Tradeify")
    expect(entry.login).toBeNull()
    expect(entry.state).toEqual(state)
  })
})
