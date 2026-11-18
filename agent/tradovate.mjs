/**
 * What a person does on trader.tradovate.com to get the two exports of an account, as code:
 * open the account menu, click the account's gear (its reports), then for Fills and Cash History
 * pick the dates, press Go and download the CSV. Read-only: no order, no account setting.
 *
 * The page is often translated by the browser, so nothing is matched on visible text: only on
 * stable attributes and positions.
 */
import { randomUUID } from "node:crypto"
import { mkdir, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

export const TRADOVATE_URL = "https://trader.tradovate.com/"

/** Raised when the page is on the login page: the saved login did not get in. */
export class NeedsLoginError extends Error {}
/** Raised when the account is not in this Tradovate login. */
export class AccountNotFoundError extends Error {}

const TAB = { fills: 5, cash: 3 } // positions in the reports tab bar
const accountSelector = ".account-selector-wrapper"

/** "2026-10-01" → "10/01/2026", the format of the date fields. */
export function tradovateDate(day) {
  const [year, month, date] = day.split("-")
  return `${month}/${date}/${year}`
}

/** Whether an error only says that the page or browser was closed under us (a closed browser). */
export const isClosedError = (error) =>
  /has been closed|Target closed|Browser closed/i.test(error?.message ?? "")

/** Whether Playwright gave up waiting for something on the page (a slow Tradovate, not a wrong login). */
export const isTimeoutError = (error) => error?.name === "TimeoutError"

/**
 * What the page looked like when something failed: its address, the tabs it showed and, when
 * `dir` is given, a screenshot saved there. It never throws: a diagnostic must not hide the error.
 */
export async function diagnose(page, label, dir = process.env.DIAGNOSTICS_DIR) {
  const tabs = await page
    .locator("ul.nav-tabs li a")
    .allInnerTexts()
    .catch(() => [])
  let screenshot = null
  if (dir) {
    const file = join(dir, `${label.replace(/[^a-z0-9]+/gi, "-")}-${Date.now()}.png`)
    try {
      await mkdir(dir, { recursive: true })
      await page.screenshot({ path: file, fullPage: true })
      screenshot = file
    } catch {
      // No screenshot: the address and the tabs still say something.
    }
  }
  return { url: page.url(), tabs, screenshot }
}

/** Raised when the saved login did not get through (wrong password, a check, a captcha...). */
export class LoginFailedError extends Error {}

const loginField = "#name-input"
/** After a login, Tradovate asks for a trading mode: Market Replay, or Simulation (prop accounts). */
const simulationButton = '[data-testid="simulation-button"]'

/** The first of the given screens to show up, as its name, or "unknown" after the timeout. */
async function firstScreen(page, screens, timeout = 25_000) {
  const seen = Object.entries(screens).map(([name, selector]) =>
    page
      .locator(selector)
      .first()
      .waitFor({ state: "visible", timeout })
      .then(() => name)
  )
  return Promise.any(seen).catch(() => "unknown")
}

/**
 * "Welcome to Tradovate Prop" page, shown after the trading mode in a browser that has never been
 * through it (a fresh profile, a cloud runner). Its only way on is a "Continue" button, with no
 * stable attribute known: the one place where the visible text is matched (English or French).
 */
const welcomeContinue = "text=/^(continue|continuer)$/i >> visible=true"

/** Picks Simulation on the trading-mode screen, passes the welcome page if any, waits for trading. */
export async function passTradingMode(page) {
  await page.locator(simulationButton).first().click()
  const screen = await firstScreen(page, { in: accountSelector, welcome: welcomeContinue }, 30_000)
  if (screen === "welcome") await page.locator(welcomeContinue).first().click()
  await page.locator(accountSelector).first().waitFor({ state: "visible", timeout: 30_000 })
}

/** Waits for the trading screen; throws NeedsLoginError when the login form shows up instead. */
export async function ensureLoggedIn(page) {
  if (!page.url().startsWith(TRADOVATE_URL)) {
    await page.goto(TRADOVATE_URL, { waitUntil: "domcontentloaded" })
  }
  const screen = await firstScreen(page, {
    in: accountSelector,
    login: loginField,
    mode: simulationButton,
  })
  if (screen === "mode") return passTradingMode(page)
  if (screen !== "in") throw new NeedsLoginError("Tradovate is asking for a login.")
}

/**
 * Types a login into Tradovate's form. The password only passes through here, from the vault to
 * the field: it is never logged and never put in an error message.
 */
export async function autoLogin(page, { username, password }) {
  await page.locator(loginField).fill(username)
  await page.locator("#password-input").fill(password)
  await page.locator("#password-input").press("Enter")
  // The login form is still on screen for a moment: only the screens after it count here.
  const screen = await firstScreen(page, { in: accountSelector, mode: simulationButton }, 30_000)
  if (screen === "mode") return passTradingMode(page)
  if (screen !== "in") {
    throw new LoginFailedError("Tradovate did not accept the login (or asked for a check).")
  }
}

async function closeReports(page) {
  const close = page.locator("button.close").first()
  if (await close.isVisible()) await close.click()
}

/** Opens the account menu unless the given account line is already showing. */
async function openAccountMenu(page, item) {
  if (await item.isVisible()) return
  await page.locator(accountSelector).first().click()
  await page.locator(".account-selector li").first().waitFor({ state: "visible", timeout: 10_000 })
}

/** Opens the reports of one account from the account menu. */
export async function openReports(page, tradovateName) {
  await closeReports(page)
  const item = page.locator(`li[data-testid="account-item-${tradovateName}"]`)
  await openAccountMenu(page, item)
  if ((await item.count()) === 0) {
    throw new AccountNotFoundError(`${tradovateName} is not in this Tradovate login.`)
  }
  await item.hover()
  const gear = item.locator(".btn-icon")
  const gearShown = await gear
    .waitFor({ state: "visible", timeout: 3_000 })
    .then(() => true)
    .catch(() => false)
  if (!gearShown) {
    // Tradovate only shows the gear on the selected account: select this one, then reopen the menu.
    await item.click()
    await openAccountMenu(page, item)
    await item.hover()
  }
  await gear.click({ timeout: 10_000 })
  await page.locator("ul.nav-tabs").waitFor({ state: "visible", timeout: 15_000 })
}

/**
 * The period menu of the reports (the one offering "Custom Range"). Not the first select of the page:
 * a login with several accounts also shows an account menu before it.
 */
export function rangeSelect(page) {
  return page
    .locator("select.form-control")
    .filter({ has: page.locator('option[value="Custom Range"]') })
    .first()
}

/**
 * The CSV of the open tab for a period, or undefined when the period holds no rows. The download
 * button uses the dates in the fields: pressing Go first only redraws the table on screen.
 */
async function downloadTab(page, tab, { from, to }) {
  await page.locator("ul.nav-tabs li a").nth(TAB[tab]).click()
  const range = rangeSelect(page)
  await range.waitFor({ state: "visible", timeout: 10_000 })
  await range.selectOption({ value: "Custom Range" })
  const fields = page.locator('input.form-control[placeholder*="/"]')
  await fields.nth(1).waitFor({ state: "visible", timeout: 10_000 })
  await fields.nth(0).fill(tradovateDate(from))
  await fields.nth(0).press("Enter")
  await fields.nth(1).fill(tradovateDate(to))
  await fields.nth(1).press("Enter")

  const file = join(tmpdir(), `tradelog-${randomUUID()}.csv`)
  try {
    const csv = page.locator("button.btn.btn-outline").filter({ hasText: /CSV/ }).first()
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 30_000 }),
      csv.click(),
    ])
    await download.saveAs(file)
    const text = await readFile(file, "utf8")
    return text.trim().length > 20 ? text : undefined
  } finally {
    await rm(file, { force: true })
  }
}

/** The Fills and Cash History CSV of an account for a period (a file is undefined when it is empty). */
export async function exportAccount(page, tradovateName, period) {
  await ensureLoggedIn(page)
  try {
    await openReports(page, tradovateName)
    const fills = await downloadTab(page, "fills", period)
    const cash = await downloadTab(page, "cash", period)
    return { fills, cash }
  } catch (error) {
    // Looked at before the reports are closed below: that is the page that failed.
    if (!(error instanceof AccountNotFoundError)) {
      error.diagnostic = await diagnose(page, tradovateName)
    }
    throw error
  } finally {
    await closeReports(page).catch(() => {}) // never hides the error above
  }
}
