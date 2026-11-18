import { describe, expect, it } from "vitest"
import { filterTransactions, parseRegistryFilters, registryNet, registryOptions } from "./registry"
import type { TransactionType } from "./investments"

const row = (
  day: string,
  firm: string,
  accountId: string | null,
  type: TransactionType,
  amount: number
) => ({ day, firm, accountId, type, amount })

const rows = [
  row("2026-10-02", "Apex", "a1", "evaluation", 40),
  row("2026-09-10", "apex", "a2", "payout", 500),
  row("2025-12-01", "Tradeify", null, "subscription", 25),
]

describe("parseRegistryFilters", () => {
  it("reads the filters and ignores bad values", () => {
    expect(parseRegistryFilters({ firm: "Apex", account: "a1", year: "2026", page: "3" })).toEqual({
      firm: "apex",
      accountId: "a1",
      year: "2026",
      page: 3,
    })
    expect(parseRegistryFilters({ firm: "all", account: "all", year: "x", page: "-1" })).toEqual({
      firm: null,
      accountId: null,
      year: null,
      page: 1,
    })
  })
})

describe("filterTransactions", () => {
  const all = { firm: null, accountId: null, year: null, page: 1 }

  it("keeps everything without a filter", () => {
    expect(filterTransactions(rows, all)).toHaveLength(3)
  })

  it("filters by firm ignoring case, by account and by year", () => {
    expect(filterTransactions(rows, { ...all, firm: "apex" })).toHaveLength(2)
    expect(filterTransactions(rows, { ...all, accountId: "a2" })).toHaveLength(1)
    expect(filterTransactions(rows, { ...all, year: "2025" })).toHaveLength(1)
    expect(filterTransactions(rows, { ...all, firm: "apex", year: "2026" })).toHaveLength(2)
  })
})

describe("registryOptions", () => {
  it("lists firms once and years newest first", () => {
    expect(registryOptions(rows)).toEqual({
      firms: [
        { value: "apex", label: "Apex" },
        { value: "tradeify", label: "Tradeify" },
      ],
      years: ["2026", "2025"],
    })
  })
})

describe("registryNet", () => {
  it("adds payouts and subtracts costs", () => {
    expect(registryNet(rows)).toBe(435)
  })
})
