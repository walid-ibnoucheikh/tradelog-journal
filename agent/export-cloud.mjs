/**
 * `npm run agent:export-cloud -- Tradeify Lucid`: packs the saved login and the browser state of
 * these prop firms (with --no-logins, the browser states alone) into ~/.tradelog-agent/cloud-vault.txt (readable by you only), to be pasted
 * into the GitHub secret TRADELOG_CLOUD_VAULT. Nothing is printed except counts: it holds
 * passwords and session tokens, treat it like a password.
 */
import { chmodSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { openBrowser } from "./browser.mjs"
import { packCloudVault } from "./cloud-vault.mjs"
import { parseExportArgs } from "./export-args.mjs"
import { describeState, expiryLines, SECRET_LIMIT_BYTES } from "./state.mjs"
import { TRADOVATE_URL } from "./tradovate.mjs"
import { AGENT_DIR, openVault } from "./vault.mjs"

const { firms, noLogins } = parseExportArgs(process.argv.slice(2))
if (firms.length === 0) {
  console.error("Usage: npm run agent:export-cloud -- [--no-logins] <prop firm> [<prop firm> ...]")
  console.error("  --no-logins  leave the usernames and passwords out: only the browser states")
  process.exit(1)
}

const vault = openVault()
const entries = []
for (const firm of firms) {
  // With --no-logins the passwords stay on this PC and in the app: the secret holds states only.
  const login = noLogins ? null : vault.get(firm)
  if (!login && !noLogins)
    console.log(`${firm}: no saved login on this PC (npm run agent:login -- ${firm}).`)
  const context = await openBrowser(firm)
  try {
    const page = context.pages()[0] ?? (await context.newPage())
    // Opened so that Tradovate's local storage is part of the state.
    await page.goto(TRADOVATE_URL, { waitUntil: "domcontentloaded" })
    await page.waitForTimeout(3000)
    const state = await context.storageState()
    const { cookies, storageItems } = describeState(state)
    console.log(
      `${firm}: login ${noLogins ? "left out" : login ? "found" : "MISSING"}, ${cookies} cookies, ${storageItems} stored items.`
    )
    for (const line of expiryLines(state)) console.log(`${firm}: ${line}`)
    entries.push({ firm, login, state })
  } finally {
    await context.close()
  }
}

const packed = packCloudVault(entries)
const file = join(AGENT_DIR, "cloud-vault.txt")
writeFileSync(file, packed, { mode: 0o600 })
chmodSync(file, 0o600)
console.log(`Written to ${file}: ${packed.length} characters.`)
if (packed.length > SECRET_LIMIT_BYTES) {
  console.log("Above the 48 KB limit of a GitHub secret: export fewer prop firms at once.")
}
console.log("Copy it without displaying it (Windows clipboard):")
console.log(`  clip.exe < ${file}`)
