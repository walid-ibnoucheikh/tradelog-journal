import { describe, expect, it } from "vitest"
import { groupAccountsByFirm, sortByEndDate } from "./groups"

describe("groupAccountsByFirm", () => {
  it("groups by firm without caring about case or spaces, in order of first appearance", () => {
    const groups = groupAccountsByFirm([
      { id: 1, firm: "Tradeify" },
      { id: 2, firm: "Apex" },
      { id: 3, firm: "tradeify " },
      { id: 4, firm: "APEX" },
    ])
    expect(groups.map((group) => [group.firm, group.accounts.map((a) => a.id)])).toEqual([
      ["Tradeify", [1, 3]],
      ["Apex", [2, 4]],
    ])
  })

  it("names the group with the spelling most accounts use", () => {
    const groups = groupAccountsByFirm([{ firm: "apex" }, { firm: "Apex" }, { firm: "Apex" }])
    expect(groups.map((group) => group.firm)).toEqual(["Apex"])
  })

  it("prefers a capital letter when two spellings are equally used", () => {
    const groups = groupAccountsByFirm([{ firm: "apex" }, { firm: "Apex" }])
    expect(groups.map((group) => group.firm)).toEqual(["Apex"])
  })

  it("returns nothing for no account", () => {
    expect(groupAccountsByFirm([])).toEqual([])
  })
})

describe("sortByEndDate", () => {
  it("puts the most recently ended account first and an undated one last", () => {
    const sorted = sortByEndDate([
      { id: 1, endedAt: "2026-08-01" },
      { id: 2, endedAt: null },
      { id: 3, endedAt: "2026-10-12" },
    ])
    expect(sorted.map((account) => account.id)).toEqual([3, 1, 2])
  })

  it("lets firms be grouped by their latest loss", () => {
    const groups = groupAccountsByFirm(
      sortByEndDate([
        { firm: "Apex", endedAt: "2026-07-01" },
        { firm: "Tradeify", endedAt: "2026-10-01" },
        { firm: "Apex", endedAt: "2026-09-01" },
      ])
    )
    expect(groups.map((group) => group.firm)).toEqual(["Tradeify", "Apex"])
    expect(groups[1].accounts.map((account) => account.endedAt)).toEqual([
      "2026-09-01",
      "2026-07-01",
    ])
  })
})
