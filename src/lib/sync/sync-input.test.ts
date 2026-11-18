import { describe, expect, it } from "vitest"
import { isUuid, parseFinish } from "./sync-input"

describe("isUuid", () => {
  it("accepts a uuid and refuses anything else", () => {
    expect(isUuid("3f2b8c1e-5d4a-4b7e-9c10-0a1b2c3d4e5f")).toBe(true)
    expect(isUuid("not-a-uuid")).toBe(false)
    expect(isUuid("3f2b8c1e-5d4a-4b7e-9c10-0a1b2c3d4e5f'; drop table x;--")).toBe(false)
  })
})

describe("parseFinish", () => {
  it("accepts the three outcomes and trims the message", () => {
    expect(parseFinish({ status: "done", message: "  2 accounts  " })).toMatchObject({
      status: "done",
      message: "2 accounts",
    })
    expect(parseFinish({ status: "needs_login", message: "Lucid" })?.status).toBe("needs_login")
    expect(parseFinish({ status: "failed", message: "x" })?.status).toBe("failed")
  })

  it("refuses anything else", () => {
    expect(parseFinish(null)).toBeNull()
    expect(parseFinish("done")).toBeNull()
    expect(parseFinish({ status: "pending", message: "x" })).toBeNull()
    expect(parseFinish({ status: "done" })).toBeNull()
  })

  it("keeps a message long enough for one line per account, and caps it", () => {
    expect(parseFinish({ status: "done", message: "x".repeat(3000) })?.message).toHaveLength(3000)
    expect(parseFinish({ status: "failed", message: "x".repeat(9000) })?.message).toHaveLength(4000)
  })
})

describe("parseFinish found and missing", () => {
  const id = "3f2b8c1e-5d4a-4b7e-9c10-0a1b2c3d4e5f"

  it("reads the accounts the agent did and did not find, and defaults to none", () => {
    expect(parseFinish({ status: "done", message: "ok", found: [id], missing: [] })).toMatchObject({
      found: [id],
      missing: [],
    })
    expect(parseFinish({ status: "failed", message: "x", missing: [id] })).toMatchObject({
      found: [],
      missing: [id],
    })
    expect(parseFinish({ status: "done", message: "ok" })).toMatchObject({ found: [], missing: [] })
  })

  it("reads the accounts exported with nothing to import, and defaults to none", () => {
    expect(parseFinish({ status: "done", message: "ok", empty: [id] })).toMatchObject({
      empty: [id],
    })
    expect(parseFinish({ status: "done", message: "ok" })).toMatchObject({ empty: [] })
    expect(parseFinish({ status: "done", message: "ok", empty: "x" })).toBeNull()
  })

  it("refuses anything that is not a list of uuids", () => {
    expect(parseFinish({ status: "done", message: "ok", found: "x" })).toBeNull()
    expect(parseFinish({ status: "done", message: "ok", found: ["not-a-uuid"] })).toBeNull()
    expect(parseFinish({ status: "done", message: "ok", missing: [1] })).toBeNull()
    expect(
      parseFinish({ status: "done", message: "ok", found: new Array(501).fill(id) })
    ).toBeNull()
  })
})
