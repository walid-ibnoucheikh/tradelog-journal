import { describe, expect, it } from "vitest"
import {
  COLLAPSE_FROM,
  canFinalSync,
  countRows,
  filterRows,
  groupImportRows,
  importRows,
  startsOpen,
  type ImportAccount,
} from "./import-overview"

// Wednesday 4 November 2026, 15:00 UTC: the last weekday is Tuesday the 3rd.
const now = new Date("2026-11-04T15:00:00Z")

const account = (over: Partial<ImportAccount> & { name: string }): ImportAccount => ({
  id: over.name,
  firm: "Lucid",
  type: "eval",
  status: "active",
  lastImportedAt: new Date("2026-11-03T20:00:00Z"),
  lastTradeAt: null,
  endedAt: null,
  notFoundAt: null,
  ...over,
})

const accounts = [
  account({ name: "Lucid 50K" }), // fresh
  account({ name: "Lucid 25K", lastImportedAt: new Date("2026-10-28T20:00:00Z") }), // stale
  account({ name: "Apex 1", firm: "Apex", lastImportedAt: null }), // never
  account({ name: "Apex 2", firm: "apex", status: "blown", endedAt: "2026-10-05" }), // ended
  account({ name: "Tradeify 1", firm: "Tradeify" }), // fresh
]

describe("importRows and countRows", () => {
  it("tells each account's state and counts them", () => {
    const rows = importRows(accounts, now)
    expect(rows.map((row) => row.state)).toEqual(["fresh", "stale", "never", "ended", "fresh"])
    expect(countRows(rows)).toEqual({ active: 4, fresh: 2, stale: 1, never: 1, ended: 1 })
  })
})

describe("filterRows", () => {
  const rows = importRows(accounts, now)
  const all = { query: "", firm: "all", scope: "active" as const, attentionOnly: false }

  it("shows active accounts by default and ended ones on request", () => {
    expect(filterRows(rows, all).map((row) => row.name)).not.toContain("Apex 2")
    expect(filterRows(rows, { ...all, scope: "ended" }).map((row) => row.name)).toEqual(["Apex 2"])
    expect(filterRows(rows, { ...all, scope: "all" })).toHaveLength(5)
  })

  it("filters by firm (any spelling), search and attention", () => {
    expect(filterRows(rows, { ...all, scope: "all", firm: "apex" })).toHaveLength(2)
    expect(filterRows(rows, { ...all, query: " 25k " }).map((row) => row.name)).toEqual([
      "Lucid 25K",
    ])
    expect(filterRows(rows, { ...all, attentionOnly: true }).map((row) => row.name)).toEqual([
      "Lucid 25K",
      "Apex 1",
    ])
  })
})

describe("groupImportRows", () => {
  it("puts what needs an import first, in the groups and in each group", () => {
    const groups = groupImportRows(importRows(accounts, now))
    // Lucid and Apex each have one thing to do; the tie is broken by name; Tradeify has none.
    expect(groups.map((group) => group.firm)).toEqual(["Apex", "Lucid", "Tradeify"])
    expect(groups[1].rows.map((row) => row.name)).toEqual(["Lucid 25K", "Lucid 50K"])
    expect(groups[0].rows.map((row) => row.state)).toEqual(["never", "ended"])
  })
})

describe("startsOpen", () => {
  it("opens the groups for a few accounts and folds them for many", () => {
    expect(startsOpen(3)).toBe(true)
    expect(startsOpen(COLLAPSE_FROM - 1)).toBe(true)
    expect(startsOpen(COLLAPSE_FROM)).toBe(false)
  })
})

describe("canFinalSync", () => {
  it("offers a last export for accounts that ended in the last 30 days only", () => {
    const rows = importRows(
      [
        account({ name: "recent", status: "blown", endedAt: "2026-10-20" }),
        account({ name: "old", status: "blown", endedAt: "2026-09-01" }),
        account({ name: "no date", status: "closed", endedAt: null }),
        account({ name: "active" }),
      ],
      now
    )
    expect(rows.map((row) => canFinalSync(row, now))).toEqual([true, false, false, false])
  })
})
