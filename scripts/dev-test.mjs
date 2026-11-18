// Starts `next dev` on the Neon `test` branch, so a long command is not needed (and production is never touched).
// Hot reload works here: edits show up in the browser by themselves, no restart.
import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"

process.loadEnvFile(fileURLToPath(new URL("../.env.test.local", import.meta.url)))
const url = process.env.TEST_DATABASE_URL
if (!url) {
  console.error("TEST_DATABASE_URL is missing in .env.test.local")
  process.exit(1)
}

const child = spawn("npx", ["next", "dev"], {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: url },
})
child.on("exit", (code) => process.exit(code ?? 0))
process.on("SIGINT", () => child.kill("SIGINT"))
process.on("SIGTERM", () => child.kill("SIGTERM"))
