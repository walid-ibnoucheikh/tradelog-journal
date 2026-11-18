/**
 * Entry point of the "Cloud sync" GitHub workflow: takes the waiting sync request from the app, runs
 * it in a fresh browser (logins and browser state from the TRADELOG_CLOUD_VAULT secret) and sends
 * the files back. Exits 0 when the request is done or when there was nothing to do (cancelled
 * meanwhile), 1 otherwise so that the run shows red and GitHub can e-mail you.
 */
import { readFileSync } from "node:fs"
import { chromium } from "playwright-core"
import { createApi } from "./api.mjs"
import { openCloudVault, withAppLogins } from "./cloud-vault.mjs"
import { runCloudRequest } from "./cloud-core.mjs"
import { loadConfig } from "./config.mjs"
import { autoLogin, ensureLoggedIn, exportAccount } from "./tradovate.mjs"

const log = (message) => console.log(`[${new Date().toISOString()}] ${message}`)
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const config = loadConfig()
const [target] = config.targets
const api = createApi({ baseUrl: target.baseUrl, token: config.token })
// In GitHub the vault is a secret in the environment; on this PC (`npm run agent:cloud-local`) it
// is read from the file that agent:export-cloud wrote.
const file = process.env.TRADELOG_CLOUD_VAULT_FILE
const cloudVault = openCloudVault(
  file ? readFileSync(file, "utf8") : process.env.TRADELOG_CLOUD_VAULT
)
log(`Cloud sync for ${target.name}; prop firms in the vault: ${cloudVault.firms().join(", ")}.`)

// The nightly run (GitHub cron) and a run started by hand with "queue all" have no click behind them: they
// queue the sync of all active accounts themselves.
if (process.env.GITHUB_EVENT_NAME === "schedule" || process.env.QUEUE_ALL === "true") {
  await api.schedule()
  log("Sync of all active accounts queued.")
}

// The workflow starts a little after the click: the request is normally already waiting.
let request = null
for (let attempt = 1; attempt <= 8 && !request; attempt++) {
  ;({ request } = await api.next())
  if (!request) await sleep(8000)
}
if (!request) {
  log("No waiting request: it was cancelled or already handled. Nothing to do.")
  process.exit(0)
}
log(`Request received, ${request.accounts.length} account(s).`)

// In GitHub the runner's own Google Chrome is used (PLAYWRIGHT_CHROME_CHANNEL=chrome): downloading
// Chromium and its system packages took from 20 s to 2 minutes, depending on the runner.
const channel = process.env.PLAYWRIGHT_CHROME_CHANNEL || undefined
const browser = await chromium.launch({ headless: true, channel })
const status = await runCloudRequest({
  api,
  request,
  // Logins saved in the app win; a firm without a state of its own borrows one from the vault.
  vault: withAppLogins(cloudVault, request.logins),
  tradovate: { ensureLoggedIn, autoLogin, exportAccount },
  log,
  async openFirm(_firm, state) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      acceptDownloads: true,
      storageState: state ?? undefined,
    })
    return { page: await context.newPage(), close: () => context.close() }
  },
}).finally(() => browser.close())
process.exit(status === "done" || status === "cancelled" ? 0 : 1)
