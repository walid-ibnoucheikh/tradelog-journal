import { describe, expect, it } from "vitest"
import {
  accountParam,
  accountsInScope,
  defaultScopeFor,
  parseFilters,
  rangeBounds,
} from "./filters"

describe("parseFilters", () => {
  it("falls back to every account (the pages of history) and the full period", () => {
    expect(parseFilters({})).toEqual({ accountId: null, scope: "all", range: "all" })
    expect(parseFilters({ account: "nonsense-group", range: "nonsense" })).toMatchObject({
      accountId: "nonsense-group",
      range: "all",
    })
  })

  it("uses the default of the page that asks (the Dashboard: the active accounts)", () => {
    expect(parseFilters({}, "active")).toMatchObject({ accountId: null, scope: "active" })
    // An explicit choice always wins over the default.
    expect(parseFilters({ account: "all" }, "active")).toMatchObject({ scope: "all" })
    expect(parseFilters({ account: "funded" }, "active")).toMatchObject({ scope: "funded" })
  })

  it("reads a group of accounts", () => {
    expect(parseFilters({ account: "active" })).toMatchObject({ accountId: null, scope: "active" })
    expect(parseFilters({ account: "funded" })).toMatchObject({ accountId: null, scope: "funded" })
    expect(parseFilters({ account: "eval" })).toMatchObject({ accountId: null, scope: "eval" })
  })

  it("reads a valid account and range", () => {
    expect(parseFilters({ account: "abc", range: "30d" })).toEqual({
      accountId: "abc",
      scope: "all",
      range: "30d",
    })
  })
})

describe("defaultScopeFor", () => {
  it("is the active accounts on the Dashboard and every account on the pages of history", () => {
    expect(defaultScopeFor("/")).toBe("active")
    for (const path of ["/trades", "/journal", "/reports", "/reports/day"]) {
      expect(defaultScopeFor(path)).toBe("all")
    }
  })
})

describe("accountParam", () => {
  it("writes nothing for the page's default, else the group name or the account id", () => {
    expect(accountParam({ accountId: null, scope: "all" })).toBeNull()
    expect(accountParam({ accountId: null, scope: "active" })).toBe("active")
    expect(accountParam({ accountId: null, scope: "funded" })).toBe("funded")
    expect(accountParam({ accountId: "abc", scope: "all" })).toBe("abc")
  })

  it("follows the default of the page it is written for", () => {
    expect(accountParam({ accountId: null, scope: "active" }, "active")).toBeNull()
    // A link from the Dashboard to a page of history must say "active" explicitly.
    expect(accountParam({ accountId: null, scope: "active" }, "all")).toBe("active")
    expect(accountParam({ accountId: null, scope: "all" }, "active")).toBe("all")
  })
})

describe("accountsInScope", () => {
  const accounts = [
    { id: "1", status: "active", type: "eval" },
    { id: "2", status: "blown", type: "eval" },
    { id: "3", status: "active", type: "funded" },
    { id: "4", status: "closed", type: "funded" },
  ]
  const ids = (scope: Parameters<typeof accountsInScope>[1]) =>
    accountsInScope(accounts, scope).map((account) => account.id)

  it("keeps every account, the active ones, or one type whatever its state", () => {
    expect(ids("all")).toEqual(["1", "2", "3", "4"])
    expect(ids("active")).toEqual(["1", "3"])
    expect(ids("funded")).toEqual(["3", "4"])
    expect(ids("eval")).toEqual(["1", "2"])
  })
})

describe("rangeBounds", () => {
  const now = new Date("2026-03-02T15:00:00Z")

  it("computes inclusive bounds in the trading timezone", () => {
    expect(rangeBounds("all", now)).toEqual({ from: null, to: null })
    expect(rangeBounds("today", now)).toEqual({ from: "2026-03-02", to: "2026-03-02" })
    expect(rangeBounds("7d", now)).toEqual({ from: "2026-02-24", to: "2026-03-02" })
    expect(rangeBounds("30d", now)).toEqual({ from: "2026-02-01", to: "2026-03-02" })
    expect(rangeBounds("month", now)).toEqual({ from: "2026-03-01", to: "2026-03-02" })
    expect(rangeBounds("lastMonth", now)).toEqual({ from: "2026-02-01", to: "2026-02-28" })
    expect(rangeBounds("year", now)).toEqual({ from: "2026-01-01", to: "2026-03-02" })
  })

  it("handles the previous month across a year boundary", () => {
    expect(rangeBounds("lastMonth", new Date("2026-01-10T15:00:00Z"))).toEqual({
      from: "2025-12-01",
      to: "2025-12-31",
    })
  })
})
