import { describe, expect, it } from "vitest"
import { accountDetails, matchAccounts, splitByState, type PickerAccount } from "./account-picker"

const account = (overrides: Partial<PickerAccount>): PickerAccount => ({
  id: "1",
  name: "Account",
  firm: "Apex",
  status: "active",
  type: "eval",
  initialBalance: 50_000,
  ...overrides,
})

describe("accountDetails", () => {
  it("gives firm, size and type, and the state of an account that is over", () => {
    expect(accountDetails(account({}))).toBe("Apex · 50K · Eval")
    expect(accountDetails(account({ type: "funded", initialBalance: 25_000 }))).toBe(
      "Apex · 25K · Funded"
    )
    expect(accountDetails(account({ status: "blown" }))).toBe("Apex · 50K · Eval · Blown")
  })
})

describe("matchAccounts", () => {
  const accounts = [
    account({ id: "1", name: "LUCID-1", firm: "Lucid", initialBalance: 50_000 }),
    account({
      id: "2",
      name: "Tradeify 25",
      firm: "Tradeify",
      initialBalance: 25_000,
      type: "funded",
    }),
    account({ id: "3", name: "Apex old", firm: "Apex", status: "blown" }),
  ]
  const ids = (query: string) => matchAccounts(accounts, query).map((a) => a.id)

  it("finds by name, firm, size, type or state, with every word", () => {
    expect(ids("lucid")).toEqual(["1"])
    expect(ids("25k funded")).toEqual(["2"])
    expect(ids("blown")).toEqual(["3"])
    expect(ids("apex 50k")).toEqual(["3"])
  })

  it("returns everything for an empty query and nothing when nothing matches", () => {
    expect(ids("  ")).toHaveLength(3)
    expect(ids("zzz")).toEqual([])
  })
})

describe("splitByState", () => {
  it("separates the active accounts from the ended ones, each sorted by name", () => {
    const { active, ended } = splitByState([
      account({ id: "1", name: "B", status: "active" }),
      account({ id: "2", name: "A", status: "closed" }),
      account({ id: "3", name: "A", status: "active" }),
      account({ id: "4", name: "C", status: "blown" }),
    ])
    expect(active.map((a) => a.id)).toEqual(["3", "1"])
    expect(ended.map((a) => a.id)).toEqual(["2", "4"])
  })
})
