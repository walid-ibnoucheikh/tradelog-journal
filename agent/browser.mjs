import { mkdirSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { chromium } from "playwright-core"
import { firmKey } from "./firm.mjs"

/**
 * One browser profile per prop firm, because each firm gives its own Tradovate login. The profile
 * holds the login session (cookies) and lives in the home folder, never in the repository.
 * The password is typed by Walid in the window; nothing here ever sees or stores it.
 */
export const PROFILES_DIR = join(homedir(), ".tradelog-agent", "profiles")

export function profileDir(firm) {
  const dir = join(PROFILES_DIR, firmKey(firm))
  mkdirSync(dir, { recursive: true, mode: 0o700 })
  return dir
}

/** Opens the persistent browser of a firm: invisible by default, `headless: false` shows the window. */
export async function openBrowser(firm, { headless = true } = {}) {
  return chromium.launchPersistentContext(profileDir(firm), {
    headless,
    // A visible window follows the screen; the invisible one needs a size wide enough for the reports.
    viewport: headless ? { width: 1440, height: 900 } : null,
    acceptDownloads: true,
  })
}
