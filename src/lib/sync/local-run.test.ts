import { describe, expect, it } from "vitest"
import { localAppUrl } from "./local-run"

describe("localAppUrl", () => {
  it("accepts this machine on any port", () => {
    expect(localAppUrl("localhost:3000")).toBe("http://localhost:3000")
    expect(localAppUrl("127.0.0.1:3001")).toBe("http://127.0.0.1:3001")
  })

  it("refuses any other host, so the sync token is never sent elsewhere", () => {
    expect(localAppUrl(null)).toBeNull()
    expect(localAppUrl("localhost")).toBeNull()
    expect(localAppUrl("evil.example.com")).toBeNull()
    expect(localAppUrl("localhost:3000.evil.com")).toBeNull()
    expect(localAppUrl("tradelog.example.com")).toBeNull()
  })
})
