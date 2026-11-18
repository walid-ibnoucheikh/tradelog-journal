import { describe, expect, it } from "vitest"
import {
  formatDateTime,
  formatDayYear,
  formatDuration,
  formatFileSize,
  formatMonth,
  formatPhoneAmount,
  formatPrice,
} from "./format"

describe("formatPrice", () => {
  it("uses two decimals and thousands separators", () => {
    expect(formatPrice(29785.75)).toBe("29,785.75")
    expect(formatPrice(100)).toBe("100.00")
  })
})

describe("formatDayYear", () => {
  it("gives the day, the abbreviated month and the year", () => {
    expect(formatDayYear("2026-10-15")).toBe("15 Oct 2026")
  })
})

describe("formatMonth", () => {
  it("abbreviates the month in English with a two-digit year", () => {
    expect(formatMonth("2026-09")).toBe("Sep 26")
    expect(formatMonth("2027-01")).toBe("Jan 27")
  })
})

describe("formatDuration", () => {
  it("picks the largest useful units", () => {
    expect(formatDuration(38_000)).toBe("38 s")
    expect(formatDuration(252_000)).toBe("4 min 12 s")
    expect(formatDuration(7_500_000)).toBe("2 h 05 min")
    expect(formatDuration(-5)).toBe("0 s")
  })
})

describe("formatDateTime", () => {
  it("shows the New York time, with optional seconds", () => {
    const date = new Date("2026-10-15T14:03:49Z")
    expect(formatDateTime(date)).toBe("15/10/2026, 10:03")
    expect(formatDateTime(date, true)).toBe("15/10/2026, 10:03:49")
  })
})

describe("formatFileSize", () => {
  it("picks the unit that keeps the number small", () => {
    expect(formatFileSize(840)).toBe("840 B")
    expect(formatFileSize(12 * 1024)).toBe("12 KB")
    expect(formatFileSize(1.25 * 1024 * 1024)).toMatch(/^1[,.][23] MB$/)
  })
})

describe("formatPhoneAmount", () => {
  it.each([
    [569.8, "$570"],
    [-642.3, "-$642"],
    [1.6, "$2"],
    [0, "$0"],
    [999.4, "$999"],
    [1234, "$1.2k"],
    [-1250, "-$1.3k"],
    [12_400, "$12k"],
  ])("%s -> %s", (value, text) => {
    expect(formatPhoneAmount(value)).toBe(text)
  })
})
