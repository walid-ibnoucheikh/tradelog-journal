import { describe, expect, it } from "vitest"
import { readPurchase } from "./purchase"

const ok = { amount: "149", day: "2026-11-03", type: "evaluation" }

describe("readPurchase", () => {
  it("returns nothing when the cost is left empty", () => {
    expect(readPurchase({ ...ok, amount: "" })).toEqual({ purchase: null })
    expect(readPurchase({ ...ok, amount: "   " })).toEqual({ purchase: null })
  })

  it("reads a valid purchase and rounds to cents", () => {
    expect(readPurchase({ ...ok, amount: "99.999" })).toEqual({
      purchase: { amount: 100, day: "2026-11-03", type: "evaluation" },
    })
    expect(readPurchase({ ...ok, type: "reset" })).toEqual({
      purchase: { amount: 149, day: "2026-11-03", type: "reset" },
    })
  })

  it("reports a wrong amount, day or type", () => {
    expect(readPurchase({ ...ok, amount: "abc" })).toHaveProperty("error")
    expect(readPurchase({ ...ok, amount: "0" })).toHaveProperty("error")
    expect(readPurchase({ ...ok, amount: "-5" })).toHaveProperty("error")
    expect(readPurchase({ ...ok, amount: "2000000" })).toHaveProperty("error")
    expect(readPurchase({ ...ok, day: "2026-02-31" })).toHaveProperty("error")
    // A payout or a course is not how an account is bought.
    expect(readPurchase({ ...ok, type: "payout" })).toHaveProperty("error")
    expect(readPurchase({ ...ok, type: "education" })).toHaveProperty("error")
  })
})
