/**
 * `npm run agent:export-state -- Tradeify`: packs the browser state of a prop firm's profile into a
 * file in ~/.tradelog-agent/ (readable by you only), to be pasted into the GitHub secret
 * TRADOVATE_STATE so the cloud browser is recognised like this PC's. The content is never printed:
 * treat it like a password (it can hold session tokens).
 */
import { chmodSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { openBrowser } from "./browser.mjs"
import { firmKey } from "./firm.mjs"
import { SECRET_LIMIT_BYTES, describeState, encodeState, expiryLines } from "./state.mjs"
import { TRADOVATE_URL } from "./tradovate.mjs"
import { AGENT_DIR } from "./vault.mjs"

const firm = process.argv[2]?.trim()
if (!firm) {
  console.error("Usage: npm run agent:export-state -- <prop firm>, e.g. Tradeify")
  process.exit(1)
}

const context = await openBrowser(firm)
try {
  const page = context.pages()[0] ?? (await context.newPage())
  // The page is opened so that Tradovate's local storage is part of what is exported.
  await page.goto(TRADOVATE_URL, { waitUntil: "domcontentloaded" })
  await page.waitForTimeout(3000)
  const state = await context.storageState()
  const packed = encodeState(state)
  const file = join(AGENT_DIR, `state-${firmKey(firm)}.txt`)
  writeFileSync(file, packed, { mode: 0o600 })
  chmodSync(file, 0o600)
  const { cookies, origins, storageItems } = describeState(state)
  console.log(`State of ${firm}: ${cookies} cookies, ${storageItems} items in ${origins} sites.`)
  console.log(`Written to ${file}: ${packed.length} characters.`)
  if (packed.length > SECRET_LIMIT_BYTES) {
    console.log("It is above the 48 KB limit of a GitHub secret: it has to be reduced or split.")
  }
  for (const line of expiryLines(state)) console.log(line)
  console.log("Copy it without displaying it (Windows clipboard):")
  console.log(`  clip.exe < ${file}`)
} finally {
  await context.close()
}
