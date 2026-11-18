import { describe, expect, it } from "vitest"
import { parseCsv } from "./csv"

describe("parseCsv", () => {
  it("keys each row by the trimmed header and trims values", () => {
    expect(parseCsv("a, b\n 1 , 2 \n")).toEqual([{ a: "1", b: "2" }])
  })

  it("handles quoted fields with commas, escaped quotes and newlines", () => {
    expect(parseCsv('name,amount\n"Doe, J ""JD""","50,000.00"\n"two\nlines",1')).toEqual([
      { name: 'Doe, J "JD"', amount: "50,000.00" },
      { name: "two\nlines", amount: "1" },
    ])
  })

  it("accepts a BOM and Windows line endings", () => {
    expect(parseCsv("﻿a,b\r\n1,2\r\n")).toEqual([{ a: "1", b: "2" }])
  })

  it("skips blank lines and fills missing trailing cells with an empty string", () => {
    expect(parseCsv("a,b\n\n1\n")).toEqual([{ a: "1", b: "" }])
  })

  it("returns no records for an empty file", () => {
    expect(parseCsv("")).toEqual([])
  })
})
