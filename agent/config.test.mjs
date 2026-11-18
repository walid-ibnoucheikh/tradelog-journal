import { describe, expect, it } from "vitest"
import { loadConfig } from "./config.mjs"

const token = "t".repeat(40)

describe("loadConfig", () => {
  it("defaults to the local app", () => {
    expect(loadConfig({ SYNC_TOKEN: token })).toEqual({
      targets: [{ name: "localhost", baseUrl: "http://localhost:3000" }],
      token,
    })
  })

  it("serves several apps at once, local and online, from TRADELOG_URLS", () => {
    const config = loadConfig({
      SYNC_TOKEN: token,
      TRADELOG_URLS: "http://localhost:3000, https://tradelog.example.com/some/path ",
    })
    expect(config.targets).toEqual([
      { name: "localhost", baseUrl: "http://localhost:3000" },
      { name: "tradelog.example.com", baseUrl: "https://tradelog.example.com" },
    ])
  })

  it("still reads a single TRADELOG_URL, and lists each app once", () => {
    expect(
      loadConfig({ SYNC_TOKEN: token, TRADELOG_URL: "https://tradelog.example.app" }).targets
    ).toHaveLength(1)
    expect(
      loadConfig({
        SYNC_TOKEN: token,
        TRADELOG_URLS: "http://localhost:3000,http://localhost:3000",
      }).targets
    ).toHaveLength(1)
  })

  it("refuses a short or missing token", () => {
    expect(() => loadConfig({})).toThrow(/SYNC_TOKEN/)
    expect(() => loadConfig({ SYNC_TOKEN: "short" })).toThrow(/SYNC_TOKEN/)
  })

  it("refuses plain http beyond this machine, even for one app in a list", () => {
    expect(() =>
      loadConfig({ SYNC_TOKEN: token, TRADELOG_URL: "http://tradelog.example.app" })
    ).toThrow(/https/)
    expect(() =>
      loadConfig({
        SYNC_TOKEN: token,
        TRADELOG_URLS: "http://localhost:3000,http://tradelog.example.app",
      })
    ).toThrow(/https/)
  })

  it("refuses an empty list", () => {
    expect(() => loadConfig({ SYNC_TOKEN: token, TRADELOG_URLS: " , " })).toThrow(/empty/)
  })
})
