import { mkdtempSync, readFileSync, statSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { firmKey } from "./firm.mjs"
import { openVault } from "./vault.mjs"

const newFile = () => join(mkdtempSync(join(tmpdir(), "vault-")), "logins.json")

describe("vault", () => {
  it("keeps a login across openings, readable by the owner only", () => {
    const file = newFile()
    openVault(file).set("Lucid", { username: "walid", password: "pw" })
    expect(openVault(file).get("Lucid")).toEqual({ username: "walid", password: "pw" })
    expect(statSync(file).mode & 0o777).toBe(0o600)
    expect(readFileSync(file, "utf8")).toContain("lucid")
  })

  it("finds a firm however it is written", () => {
    const file = newFile()
    openVault(file).set("Tradeify", { username: "u", password: "p" })
    const vault = openVault(file)
    expect(vault.has(" TRADEIFY ")).toBe(true)
    expect(vault.get("tradeify")?.username).toBe("u")
    expect(vault.get("Apex")).toBeNull()
  })

  it("forgets one firm and keeps the others", () => {
    const file = newFile()
    const vault = openVault(file)
    vault.set("Lucid", { username: "u", password: "p" })
    vault.set("Apex", { username: "v", password: "q" })
    vault.forget("Lucid")
    const again = openVault(file)
    expect(again.has("Lucid")).toBe(false)
    expect(again.get("Apex")?.username).toBe("v")
  })
})

describe("firmKey", () => {
  it("normalises names and refuses an empty one", () => {
    expect(firmKey("  Apex Trader Funding ")).toBe("apex-trader-funding")
    expect(() => firmKey("  ")).toThrow()
  })
})
