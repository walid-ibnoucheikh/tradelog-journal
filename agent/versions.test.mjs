import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"))

describe("agent dependencies", () => {
  it("pin the same playwright-core as the app, so the cloud run tests what the app ships", () => {
    const app = read("../package-lock.json").packages["node_modules/playwright-core"]
    const agent = read("./package-lock.json").packages["node_modules/playwright-core"]
    expect(agent.version).toBe(app.version)
    expect(agent.integrity).toBe(app.integrity)
  })
})
