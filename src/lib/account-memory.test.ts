import { describe, expect, it } from "vitest"
import { withAccount } from "./account-memory"

describe("withAccount", () => {
  it("adds the account to the pages that have an account filter", () => {
    expect(withAccount("/", "abc")).toBe("/?account=abc")
    expect(withAccount("/trades", "all")).toBe("/trades?account=all")
    expect(withAccount("/journal", "a b")).toBe("/journal?account=a%20b")
    expect(withAccount("/reports", "abc")).toBe("/reports?account=abc")
  })

  it("leaves the other pages and the no-account case alone", () => {
    expect(withAccount("/investments", "abc")).toBe("/investments")
    expect(withAccount("/import", "abc")).toBe("/import")
    expect(withAccount("/trades", null)).toBe("/trades")
  })
})
