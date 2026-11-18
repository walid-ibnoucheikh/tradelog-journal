import { existsSync, mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { diagnose } from "./tradovate.mjs"

const fakePage = ({ tabs = ["Positions", "Orders"], fail = false } = {}) => ({
  url: () => "https://trader.tradovate.com/",
  locator: () => ({
    allInnerTexts: async () => {
      if (fail) throw new Error("page closed")
      return tabs
    },
  }),
  screenshot: async ({ path }) => {
    if (fail) throw new Error("page closed")
    await import("node:fs/promises").then((fs) => fs.writeFile(path, "png"))
  },
})

describe("diagnose", () => {
  it("reports the address and the tabs, with no screenshot when no folder is given", async () => {
    expect(await diagnose(fakePage(), "Lucid 1", undefined)).toEqual({
      url: "https://trader.tradovate.com/",
      tabs: ["Positions", "Orders"],
      screenshot: null,
    })
  })

  it("saves a screenshot in the folder, named after the account", async () => {
    const dir = mkdtempSync(join(tmpdir(), "diagnose-"))
    const { screenshot } = await diagnose(fakePage(), "Lucid Flex #1", dir)
    expect(screenshot).toMatch(/Lucid-Flex-1-\d+\.png$/)
    expect(existsSync(screenshot)).toBe(true)
  })

  it("never throws, even when the page is gone", async () => {
    const dir = mkdtempSync(join(tmpdir(), "diagnose-"))
    expect(await diagnose(fakePage({ fail: true }), "Lucid", dir)).toEqual({
      url: "https://trader.tradovate.com/",
      tabs: [],
      screenshot: null,
    })
  })
})
