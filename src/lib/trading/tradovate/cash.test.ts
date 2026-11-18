import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { CashCsvError, parseCashFeesCsv } from "./cash"

const fixture = readFileSync(new URL("./__fixtures__/cash-history.csv", import.meta.url), "utf8")

const HEADER =
  "Account,Transaction ID,Timestamp,Date,Delta,Amount,Cash Change Type,Currency,Contract"
const row = (id: string, delta: string, type: string, contract = "MNQZ6") =>
  `ACC,${id},10/15/2026 15:03:49,10/15/26,${delta},"1,000.00", ${type},USD,${contract}`

describe("parseCashFeesCsv", () => {
  const fees = parseCashFeesCsv(fixture)

  it("keeps the fee rows as positive costs with Tradovate's local time", () => {
    expect(fees).toHaveLength(128)
    expect(fees[0]).toEqual({
      id: "9000002",
      account: "TESTACCOUNT0001",
      contract: "MNQZ6",
      type: "Exchange Fee",
      amount: 0.7,
      localTime: "10/15/2026 15:03:49",
    })
  })

  it("ignores deposits and paired-trade P&L, which are not fees", () => {
    expect(fees.map((fee) => fee.type)).not.toContain("Fund Transaction")
    expect(fees.map((fee) => fee.type)).not.toContain("Trade Paired")
  })

  it("takes every kind of fee, including ones it has never seen", () => {
    const parsed = parseCashFeesCsv(
      [
        HEADER,
        row("1", "-1.00", "Commission"),
        row("2", "-0.50", "Regulatory Fee"),
        row("3", "-0.25", "Platform Fee"),
      ].join("\n")
    )
    expect(parsed.map((fee) => [fee.type, fee.amount])).toEqual([
      ["Commission", 1],
      ["Regulatory Fee", 0.5],
      ["Platform Fee", 0.25],
    ])
  })

  it("turns a rebate into a negative cost", () => {
    const [rebate] = parseCashFeesCsv([HEADER, row("1", "0.10", "Exchange Fee")].join("\n"))
    expect(rebate.amount).toBe(-0.1)
  })

  it("drops duplicate transaction ids", () => {
    const line = row("1", "-1.00", "Commission")
    expect(parseCashFeesCsv([HEADER, line, line].join("\n"))).toHaveLength(1)
  })

  it("rejects files that are not a Cash History export", () => {
    expect(() => parseCashFeesCsv("symbol,qty\nMNQZ6,1\n")).toThrow(CashCsvError)
    expect(() => parseCashFeesCsv("symbol,qty\nMNQZ6,1\n")).toThrow(/missing columns/)
  })
})
