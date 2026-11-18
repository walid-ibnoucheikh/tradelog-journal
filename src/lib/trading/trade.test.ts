import { describe, expect, it } from "vitest"
import {
  describeTrade,
  matchesStatus,
  parseStatus,
  pointsPerContract,
  tradePoints,
  type StatusInput,
} from "./trade"

// An MNQ point is worth $2, so 4 contracts moving `points` gross `8 * points` dollars.
const mnq = (points: number, overrides: Partial<StatusInput> = {}): StatusInput => ({
  product: "MNQ",
  quantity: 4,
  grossPnl: points * 8,
  netPnl: points * 8 - 4.16,
  breakEvenOverride: null,
  ...overrides,
})

describe("pointsPerContract", () => {
  it("divides the gross P&L by the point value and the size", () => {
    expect(pointsPerContract({ product: "MNQ", quantity: 4, grossPnl: 16 })).toBe(2)
    expect(pointsPerContract({ product: "NQ", quantity: 1, grossPnl: 40 })).toBe(2)
    expect(pointsPerContract({ product: "MNQ", quantity: 2, grossPnl: -6 })).toBe(-1.5)
  })
})

describe("describeTrade break-even rule", () => {
  it("treats Walid's moved stop (29565.25 -> 29567.25, +2 points) as break-even despite a net gain", () => {
    const trade = mnq(2)
    expect(trade.netPnl).toBeGreaterThan(0)
    expect(describeTrade(trade)).toEqual({ status: "be", breakEvenSource: "auto" })
  })

  it("includes both bounds, one tick under the entry and one tick over the +2 points", () => {
    expect(describeTrade(mnq(-0.25)).status).toBe("be")
    expect(describeTrade(mnq(2.25)).status).toBe("be")
    expect(describeTrade(mnq(0)).status).toBe("be")
  })

  it("keeps real wins and losses outside the band", () => {
    expect(describeTrade(mnq(-0.5))).toEqual({ status: "loss", breakEvenSource: null })
    expect(describeTrade(mnq(2.5))).toEqual({ status: "win", breakEvenSource: null })
    expect(describeTrade(mnq(-20)).status).toBe("loss")
    expect(describeTrade(mnq(30)).status).toBe("win")
  })

  it("does not depend on the size or the instrument", () => {
    expect(
      describeTrade({
        product: "NQ",
        quantity: 1,
        grossPnl: 40,
        netPnl: 35,
        breakEvenOverride: null,
      }).status
    ).toBe("be")
    expect(
      describeTrade({
        product: "MNQ",
        quantity: 30,
        grossPnl: 120,
        netPnl: 90,
        breakEvenOverride: null,
      }).status
    ).toBe("be")
  })
})

describe("describeTrade manual override", () => {
  it("forces a break-even whatever the price did", () => {
    expect(describeTrade(mnq(10, { breakEvenOverride: true }))).toEqual({
      status: "be",
      breakEvenSource: "manual",
    })
  })

  it("forces 'not break-even', so the sign of the net P&L decides", () => {
    expect(describeTrade(mnq(2, { breakEvenOverride: false }))).toEqual({
      status: "win",
      breakEvenSource: null,
    })
    expect(describeTrade(mnq(0, { breakEvenOverride: false })).status).toBe("loss")
  })

  it("falls back to break-even for an exactly zero net P&L", () => {
    expect(
      describeTrade({ ...mnq(0), grossPnl: 0, netPnl: 0, breakEvenOverride: false }).status
    ).toBe("be")
  })
})

describe("parseStatus", () => {
  it("falls back to every status", () => {
    expect(parseStatus(undefined)).toBe("all")
    expect(parseStatus("nonsense")).toBe("all")
    expect(parseStatus("loss")).toBe("loss")
    expect(parseStatus(["win", "loss"])).toBe("win")
  })
})

describe("matchesStatus", () => {
  it("keeps everything for 'all' and only the matching trades otherwise", () => {
    expect(matchesStatus("loss", "all")).toBe(true)
    expect(matchesStatus("loss", "win")).toBe(false)
    expect(matchesStatus("be", "be")).toBe(true)
  })
})

describe("tradePoints", () => {
  it("is positive when a long rises or a short falls", () => {
    expect(tradePoints({ direction: "Long", avgEntry: 100, avgExit: 112.5 })).toBe(12.5)
    expect(tradePoints({ direction: "Short", avgEntry: 100, avgExit: 112.5 })).toBe(-12.5)
    expect(tradePoints({ direction: "Short", avgEntry: 100, avgExit: 90.25 })).toBe(9.75)
  })
})
