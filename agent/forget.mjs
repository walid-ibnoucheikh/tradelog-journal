/** `npm run agent:forget -- <firm>`: removes the saved Tradovate login of a prop firm from this PC. */
import { openVault } from "./vault.mjs"

const firm = process.argv[2]?.trim()
if (!firm) {
  console.error("Usage: npm run agent:forget -- <prop firm>")
  process.exit(1)
}
const vault = openVault()
if (!vault.has(firm)) {
  console.log(`No saved login for ${firm}. Saved: ${vault.firms().join(", ") || "none"}.`)
} else {
  vault.forget(firm)
  console.log(`Login for ${firm} removed.`)
}
