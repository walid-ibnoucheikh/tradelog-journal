import { describe, expect, it } from "vitest"
import { PAGE_SIZE, paginate, parsePage } from "./pagination"

const rows = (count: number) => Array.from({ length: count }, (_, index) => index + 1)

describe("paginate", () => {
  it("cuts a list into pages of PAGE_SIZE", () => {
    const result = paginate(rows(60), null)
    expect(PAGE_SIZE).toBe(25)
    expect(result.pageCount).toBe(3)
    expect(result.page).toBe(1)
    expect(result.visible).toHaveLength(25)
    expect(paginate(rows(60), 3).visible).toEqual(rows(60).slice(50))
  })

  it("keeps the requested page inside the list", () => {
    expect(paginate(rows(60), 99).page).toBe(3)
    expect(paginate(rows(60), 0).page).toBe(1)
    expect(paginate(rows(60), -4).page).toBe(1)
  })

  it("has one page for a short or empty list", () => {
    expect(paginate(rows(10), 2)).toMatchObject({ page: 1, pageCount: 1 })
    expect(paginate([], null)).toMatchObject({ page: 1, pageCount: 1, visible: [] })
  })
})

describe("parsePage", () => {
  it("reads a whole number, the first one of a repeated parameter", () => {
    expect(parsePage("3")).toBe(3)
    expect(parsePage(["2", "5"])).toBe(2)
  })

  it("gives null for anything else", () => {
    expect(parsePage(undefined)).toBeNull()
    expect(parsePage("abc")).toBeNull()
    expect(parsePage("2.5")).toBeNull()
  })
})
