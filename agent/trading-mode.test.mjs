/**
 * Checks, on fake pages, that the trading-mode step passes the "welcome" page when it shows up and
 * is unchanged when it does not. Needs the Playwright browser: skipped where it is not installed (CI).
 */
import { existsSync } from "node:fs"
import { chromium } from "playwright-core"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { passTradingMode } from "./tradovate.mjs"

const available = (() => {
  try {
    return existsSync(chromium.executablePath())
  } catch {
    return false
  }
})()

/** A fake page: Simulation leads to trading, or to a welcome page whose button leads to trading. */
const page_ = (welcomeLabel) => `
  <script>
    function showTrading() {
      document.body.innerHTML = '<div class="account-selector-wrapper">in</div>'
    }
    function afterSimulation() {
      const label = ${JSON.stringify(welcomeLabel)}
      if (!label) return showTrading()
      document.body.innerHTML = ""
      const button = document.createElement("button")
      button.innerHTML = '<span></span>'
      button.firstChild.textContent = label
      button.onclick = showTrading
      document.body.append(button)
    }
  </script>
  <button data-testid="simulation-button" onclick="afterSimulation()">Simulation</button>`

describe.skipIf(!available)("passTradingMode", { timeout: 60_000 }, () => {
  let browser
  beforeAll(async () => {
    browser = await chromium.launch({ headless: true })
  })
  afterAll(async () => {
    await browser?.close()
  })

  it("goes straight to trading when there is no welcome page", async () => {
    const page = await browser.newPage()
    await page.setContent(page_(null))
    await passTradingMode(page)
    expect(await page.locator(".account-selector-wrapper").count()).toBe(1)
  })

  it.each(["Continue", "Continuer"])("passes a welcome page with a %s button", async (label) => {
    const page = await browser.newPage()
    await page.setContent(page_(label))
    await passTradingMode(page)
    expect(await page.locator(".account-selector-wrapper").count()).toBe(1)
  })
})
