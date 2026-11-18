import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { parseFillsCsv, type Fill } from "./fills"
import { buildTrades } from "./trades"

const fixture = readFileSync(new URL("./__fixtures__/fills.csv", import.meta.url), "utf8")

describe("parseFillsCsv", () => {
  const fills = parseFillsCsv(fixture)

  it("parses every fill with trimmed sides and UTC timestamps", () => {
    expect(fills).toHaveLength(32)
    expect(fills[0]).toEqual({
      id: "691644310011",
      orderId: "691644310008",
      account: "TESTACCOUNT0001",
      contract: "MNQZ6",
      product: "MNQ",
      side: "Buy",
      quantity: 2,
      price: 29785.75,
      commission: 1.04,
      timestamp: new Date("2026-10-15T14:03:49.642Z"),
      localTime: "10/15/2026 15:03:49",
      tradeDate: "2026-10-15",
    })
  })

  it("drops duplicate fill ids", () => {
    const [header, firstRow] = fixture.split("\n")
    expect(parseFillsCsv([header, firstRow, firstRow].join("\n"))).toHaveLength(1)
  })

  it("rejects files that are not a Fills export", () => {
    expect(() => parseFillsCsv("symbol,qty\nMNQZ6,1\n")).toThrow(/missing columns/)
  })
})

describe("buildTrades on a real Tradovate export", () => {
  const { trades, openPositions } = buildTrades(parseFillsCsv(fixture))

  it("matches the gross P&L of Tradovate's Performance report, trade by trade", () => {
    expect(trades.map((trade) => trade.grossPnl)).toEqual([
      6, 520.5, 576, 16, 624, 14, -648, 24.5, -579, 232.5, -300, 10.5, 139.5, 37.5, 48, 22,
    ])
  })

  it("handles shorts, which open with a sell", () => {
    expect(trades.filter((trade) => trade.direction === "Short")).toHaveLength(4)
  })

  it("matches the daily realized P&L of the Account Balance History", () => {
    const byDay = new Map<string, number>()
    for (const trade of trades) {
      const day = trade.closedAt.toISOString().slice(0, 10)
      byDay.set(day, Math.round(((byDay.get(day) ?? 0) + trade.netPnl) * 100) / 100)
    }
    expect(Object.fromEntries(byDay)).toEqual({
      "2026-10-15": 521.3,
      "2026-10-19": 569.76,
      "2026-10-20": 631.68,
      "2026-10-21": -642.32,
      "2026-10-23": -404.02,
    })
  })

  it("leaves no open position", () => {
    expect(openPositions).toEqual([])
  })
})

let nextId = 1
function fill(side: "Buy" | "Sell", quantity: number, price: number, minute: number): Fill {
  return {
    id: String(nextId++),
    orderId: "1",
    account: "A",
    contract: "MNQZ6",
    product: "MNQ",
    side,
    quantity,
    price,
    commission: quantity * 0.5,
    timestamp: new Date(Date.UTC(2026, 9, 1, 14, minute)),
    localTime: `10/01/2026 15:${String(minute).padStart(2, "0")}:00`,
    tradeDate: "2026-10-01",
  }
}

describe("buildTrades position logic", () => {
  it("keeps scale-ins and partial exits in one trade, matched FIFO", () => {
    const { trades } = buildTrades([
      fill("Buy", 2, 100, 0),
      fill("Buy", 2, 110, 1),
      fill("Sell", 1, 120, 2),
      fill("Sell", 3, 130, 3),
    ])
    expect(trades).toHaveLength(1)
    const [trade] = trades
    // FIFO: 1@100->120, 1@100->130, 2@110->130 = 20 + 30 + 40 = 90 pts * $2
    expect(trade.grossPnl).toBe(180)
    expect(trade.quantity).toBe(4)
    expect(trade.avgEntry).toBe(105)
    expect(trade.avgExit).toBe(127.5)
    expect(trade.commission).toBe(4)
    expect(trade.netPnl).toBe(176)
    expect(trade.fillIds).toHaveLength(4)
  })

  it("splits a flipping fill into the closing trade and a new opposite trade", () => {
    const { trades, openPositions } = buildTrades([
      fill("Buy", 2, 100, 0),
      fill("Sell", 5, 110, 1),
      fill("Buy", 3, 105, 2),
    ])
    expect(trades).toHaveLength(2)
    expect(trades[0]).toMatchObject({ direction: "Long", grossPnl: 40, commission: 2 })
    // The 5-lot sell: 2 contracts close the long (1.0 commission), 3 open the short.
    expect(trades[1]).toMatchObject({
      direction: "Short",
      quantity: 3,
      grossPnl: 30,
      commission: 3,
    })
    expect(openPositions).toEqual([])
  })

  it("reports a position that is still open", () => {
    const { trades, openPositions } = buildTrades([fill("Sell", 3, 200, 0), fill("Buy", 1, 190, 1)])
    expect(trades).toEqual([])
    expect(openPositions).toEqual([
      expect.objectContaining({ direction: "Short", quantity: 2, avgEntry: 200 }),
    ])
  })

  it("keeps accounts and contracts separate", () => {
    const other = { ...fill("Sell", 1, 105, 1), account: "B", id: "999" }
    const { trades, openPositions } = buildTrades([fill("Buy", 1, 100, 0), other])
    expect(trades).toEqual([])
    expect(openPositions).toHaveLength(2)
  })
})
