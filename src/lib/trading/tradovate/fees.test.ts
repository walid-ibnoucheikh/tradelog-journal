import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import type { CashFee } from "./cash"
import { parseCashFeesCsv } from "./cash"
import { applyCashFees } from "./fees"
import { parseFillsCsv, type Fill } from "./fills"
import { buildTrades } from "./trades"

const read = (name: string) =>
  readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), "utf8")

function fill(overrides: Partial<Fill>): Fill {
  return {
    id: "1",
    orderId: "1",
    account: "ACC",
    contract: "MNQZ6",
    product: "MNQ",
    side: "Buy",
    quantity: 1,
    price: 100,
    commission: 0.39,
    timestamp: new Date("2026-10-27T13:47:07Z"),
    localTime: "10/27/2026 14:47:07",
    tradeDate: "2026-10-27",
    ...overrides,
  }
}

function fee(overrides: Partial<CashFee>): CashFee {
  return {
    id: "f1",
    account: "ACC",
    contract: "MNQZ6",
    type: "Exchange Fee",
    amount: 0.35,
    localTime: "10/27/2026 14:47:07",
    ...overrides,
  }
}

describe("applyCashFees on a real Tradovate export", () => {
  const fills = parseFillsCsv(read("fills.csv"))
  const fees = parseCashFeesCsv(read("cash-history.csv"))
  const result = applyCashFees(fills, fees)

  it("finds the fees of every fill, even when they are booked a second later", () => {
    expect(result.matched).toBe(32)
    expect(result.fills).toHaveLength(32)
  })

  it("replaces each commission by Tradovate's total fees for the fill", () => {
    // 2 MNQ: 1.04 commission + 2 x (0.35 + 0.19 + 0.02) of exchange, clearing and NFA fees.
    expect(result.fills[0].commission).toBe(2.16)
  })

  it("lowers the net P&L by the extra fees, as the prop firm shows it", () => {
    const net = (list: Fill[]) =>
      Math.round(buildTrades(list).trades.reduce((sum, trade) => sum + trade.netPnl, 0) * 100) / 100
    expect(net(fills)).toBe(676.4)
    // 130 contracts traded over the fills, 0.56 $ of extra fees per contract and side.
    expect(net(result.fills)).toBe(603.6)
  })
})

describe("applyCashFees", () => {
  it("sums every fee type booked for the fill", () => {
    const { fills } = applyCashFees(
      [fill({ commission: 0.39 })],
      [
        fee({ id: "a", type: "Commission", amount: 0.39 }),
        fee({ id: "b", amount: 0.35 }),
        fee({ id: "c", type: "Clearing Fee", amount: 0.19 }),
        fee({ id: "d", type: "Nfa Fee", amount: 0.02 }),
      ]
    )
    expect(fills[0].commission).toBe(0.95)
  })

  it("keeps the original commission of a fill that has no fees", () => {
    const { fills, matched } = applyCashFees([fill({ commission: 0.39 })], [])
    expect(fills[0].commission).toBe(0.39)
    expect(matched).toBe(0)
  })

  it("does not use fees of another account or contract", () => {
    const { matched } = applyCashFees(
      [fill({})],
      [fee({ id: "a", account: "OTHER" }), fee({ id: "b", contract: "NQZ6" })]
    )
    expect(matched).toBe(0)
  })

  it("splits the fees of fills in the same second by quantity", () => {
    const { fills, matched } = applyCashFees(
      [fill({ id: "1", quantity: 1 }), fill({ id: "2", quantity: 2 })],
      [fee({ amount: 1.5 })]
    )
    expect(fills.map((f) => f.commission)).toEqual([0.5, 1])
    expect(matched).toBe(2)
  })

  it("never gives the same fees to two fills", () => {
    // Only one fee row, booked at 14:47:08: it belongs to the fill at 14:47:08, not the one a
    // second earlier.
    const { fills } = applyCashFees(
      [fill({ id: "1", commission: 9 }), fill({ id: "2", localTime: "10/27/2026 14:47:08" })],
      [fee({ localTime: "10/27/2026 14:47:08", amount: 0.5 })]
    )
    expect(fills.map((f) => f.commission)).toEqual([9, 0.5])
  })

  it("does not modify the fills it receives", () => {
    const original = fill({ commission: 0.39 })
    applyCashFees([original], [fee({ amount: 5 })])
    expect(original.commission).toBe(0.39)
  })
})
