import { describe, expect, it } from "vitest"
import { breakEvenDay, cumulativeNet, monthlyCash } from "./investment-series"

const transactions = [
  { day: "2026-09-05", type: "evaluation", amount: 37.5 },
  { day: "2026-09-05", type: "reset", amount: 80 },
  { day: "2026-09-12", type: "activation", amount: 100 },
  { day: "2026-12-20", type: "payout", amount: 500 },
  { day: "2026-12-03", type: "subscription", amount: 20 },
] as const

describe("cumulativeNet", () => {
  it("sums each day, in date order, as a running total", () => {
    expect(cumulativeNet([...transactions])).toEqual([
      { date: "2026-09-05", value: -117.5 },
      { date: "2026-09-12", value: -217.5 },
      { date: "2026-12-03", value: -237.5 },
      { date: "2026-12-20", value: 262.5 },
    ])
    expect(cumulativeNet([])).toEqual([])
  })
})

describe("breakEvenDay", () => {
  it("returns the day net cash last climbed back to zero or above", () => {
    expect(breakEvenDay(cumulativeNet([...transactions]))).toBe("2026-12-20")
  })

  it("is null while still negative, or when it never went negative", () => {
    expect(breakEvenDay(cumulativeNet(transactions.slice(0, 3)))).toBeNull()
    expect(breakEvenDay([{ date: "2026-01-01", value: 50 }])).toBeNull()
    expect(breakEvenDay([])).toBeNull()
  })

  it("uses the last crossing when it dips below zero again", () => {
    expect(
      breakEvenDay([
        { date: "2026-01-01", value: -10 },
        { date: "2026-02-01", value: 5 },
        { date: "2026-03-01", value: -5 },
        { date: "2026-04-01", value: 20 },
      ])
    ).toBe("2026-04-01")
  })
})

describe("monthlyCash", () => {
  it("splits costs from payouts per month and fills the empty months", () => {
    expect(monthlyCash([...transactions])).toEqual([
      { month: "2026-09", spent: 217.5, payouts: 0 },
      { month: "2026-10", spent: 0, payouts: 0 },
      { month: "2026-11", spent: 0, payouts: 0 },
      { month: "2026-12", spent: 20, payouts: 500 },
    ])
    expect(monthlyCash([])).toEqual([])
  })

  it("crosses a year boundary", () => {
    expect(
      monthlyCash([
        { day: "2026-12-30", type: "evaluation", amount: 10 },
        { day: "2027-01-02", type: "payout", amount: 5 },
      ]).map((row) => row.month)
    ).toEqual(["2026-12", "2027-01"])
  })
})
