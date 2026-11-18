/**
 * `npm run agent:login -- Tradeify`: saves the Tradovate login of a prop firm on this PC, once.
 * You type it here (the password is not shown); it is tried right away and only kept if Tradovate
 * accepts it. After that the agent logs in by itself, with no window and no question.
 */
import { openBrowser } from "./browser.mjs"
import { ask, askHidden, canPrompt } from "./prompt.mjs"
import {
  LoginFailedError,
  NeedsLoginError,
  TRADOVATE_URL,
  autoLogin,
  ensureLoggedIn,
} from "./tradovate.mjs"
import { VAULT_FILE, openVault } from "./vault.mjs"

const firm = process.argv[2]?.trim()
if (!firm || !canPrompt()) {
  console.error("Usage: npm run agent:login -- <prop firm>   (in a terminal), e.g. Tradeify")
  process.exit(1)
}

console.log(`Enter the Tradovate login that ${firm} gave you.`)
console.log("It is typed here only, tried now, and kept on this PC if it works.")
const username = await ask("Username: ")
const password = username ? await askHidden("Password: ") : ""
if (!username || !password) {
  console.error("Nothing saved: a username and a password are needed.")
  process.exit(1)
}

const context = await openBrowser(firm)
try {
  const page = context.pages()[0] ?? (await context.newPage())
  await page.goto(TRADOVATE_URL)
  try {
    await ensureLoggedIn(page)
  } catch (error) {
    if (!(error instanceof NeedsLoginError)) throw error
    await autoLogin(page, { username, password })
  }
  openVault().set(firm, { username, password })
  console.log(`Login for ${firm} works and is saved in ${VAULT_FILE}.`)
} catch (error) {
  if (!(error instanceof LoginFailedError)) throw error
  console.error(`Nothing saved. ${error.message}`)
  process.exitCode = 1
} finally {
  await context.close()
}
