/**
 * Development only: the Sync buttons start the cloud run on this PC (`agent/cloud-run.mjs`), in the
 * background, against the local app. It is the same code the GitHub workflow runs, so a click
 * behaves like in production without a second terminal. It needs the vault that
 * `npm run agent:export-cloud` writes. The run's messages go to ~/.tradelog-agent/cloud-local.log.
 */
import { spawn } from "node:child_process"
import { existsSync, mkdirSync, openSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

const LOCAL_DIR = join(homedir(), ".tradelog-agent")
export const LOCAL_VAULT = join(LOCAL_DIR, "cloud-vault.txt")
export const LOCAL_LOG = join(LOCAL_DIR, "cloud-local.log")

const LOCAL_HOST = /^(localhost|127\.0\.0\.1):\d{2,5}$/

/** The address the run must call back (the app it was started from), only if it is this machine. */
export function localAppUrl(host: string | null): string | null {
  return host && LOCAL_HOST.test(host) ? `http://${host}` : null
}

export type LocalRunResult = { ok: true } | { ok: false; error: string }

/** Starts the run detached from the server: it ends by itself when the request is done. */
export function startLocalRun(
  host: string | null,
  env: NodeJS.ProcessEnv = process.env
): LocalRunResult {
  const url = localAppUrl(host)
  if (!url) return { ok: false, error: "The local run only starts from localhost." }
  if (!existsSync(LOCAL_VAULT)) {
    return {
      ok: false,
      error: `No vault on this PC: run "npm run agent:export-cloud -- <your prop firms>" first.`,
    }
  }
  mkdirSync(LOCAL_DIR, { recursive: true, mode: 0o700 })
  const log = openSync(LOCAL_LOG, "a")
  const child = spawn(process.execPath, ["agent/cloud-run.mjs"], {
    cwd: process.cwd(),
    detached: true,
    stdio: ["ignore", log, log],
    env: { ...env, TRADELOG_URLS: url, TRADELOG_CLOUD_VAULT_FILE: LOCAL_VAULT },
  })
  child.on("error", () => {}) // a failed start shows as a request that is never taken
  child.unref()
  return { ok: true }
}
