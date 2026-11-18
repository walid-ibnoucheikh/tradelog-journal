import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { detectTradovateFile } from "./detect"

const fixture = (name: string) =>
  readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), "utf8")

describe("detectTradovateFile", () => {
  it("recognises the two exports from their header, whatever the file is named", () => {
    expect(detectTradovateFile(fixture("fills.csv"))).toBe("fills")
    expect(detectTradovateFile(fixture("cash-history.csv"))).toBe("cash")
  })

  it("copes with a byte order mark, Windows line ends and quoted headers", () => {
    expect(detectTradovateFile('﻿"Fill ID","B/S","Price"\r\n1,Buy,2')).toBe("fills")
    expect(detectTradovateFile('Account,"Transaction ID","Cash Change Type"\r\n')).toBe("cash")
  })

  it("refuses other exports and anything that is not one", () => {
    expect(detectTradovateFile("Order ID,Account,Status\n1,A,Filled")).toBeNull()
    expect(detectTradovateFile("")).toBeNull()
    expect(detectTradovateFile("just some text")).toBeNull()
  })
})
