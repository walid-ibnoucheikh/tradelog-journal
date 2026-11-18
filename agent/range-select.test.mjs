/**
 * Checks, on a fake reports page, that the period menu is found even when an account menu comes
 * first (a login with several accounts). Needs the Playwright browser: skipped where it is not
 * installed (CI).
 */
import { existsSync } from "node:fs"
import { chromium } from "playwright-core"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { rangeSelect } from "./tradovate.mjs"

const available = (() => {
  try {
    return existsSync(chromium.executablePath())
  } catch {
    return false
  }
})()

const period = `<select class="form-control" id="period">
  <option value="Today">Today</option><option value="Custom Range">Custom Range</option></select>`
const accounts = `<select class="form-control" id="account-selector">
  <option value="1">ACCOUNT1</option><option value="2">ACCOUNT2</option></select>`

describe.skipIf(!available)("rangeSelect", { timeout: 60_000 }, () => {
  let browser
  beforeAll(async () => {
    browser = await chromium.launch({ headless: true })
  })
  afterAll(async () => {
    await browser?.close()
  })

  it.each([
    ["alone", period],
    ["after an account menu", accounts + period],
  ])("finds the period menu %s", async (_name, html) => {
    const page = await browser.newPage()
    await page.setContent(html)
    expect(await rangeSelect(page).getAttribute("id")).toBe("period")
    await rangeSelect(page).selectOption({ value: "Custom Range" })
    expect(await rangeSelect(page).inputValue()).toBe("Custom Range")
    await page.close()
  })
})
