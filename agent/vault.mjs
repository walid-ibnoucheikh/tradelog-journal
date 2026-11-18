/**
 * The Tradovate logins, kept on this PC so the agent can log in without anyone typing: one JSON file
 * in the home folder (never in the repository), readable by you only (0600), like an SSH key or
 * ~/.aws/credentials. The app and its database never see these logins.
 *
 * It is not encrypted: anyone who can read your files as you can read it. A disk encryption such as
 * BitLocker is the protection against a stolen PC.
 */
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import { firmKey } from "./firm.mjs"

export const AGENT_DIR = join(homedir(), ".tradelog-agent")
export const VAULT_FILE = join(AGENT_DIR, "logins.json")

export function openVault(file = VAULT_FILE) {
  const logins = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {}

  function save() {
    mkdirSync(dirname(file), { recursive: true, mode: 0o700 })
    const temporary = `${file}.tmp`
    writeFileSync(temporary, JSON.stringify(logins), { mode: 0o600 })
    chmodSync(temporary, 0o600)
    renameSync(temporary, file)
  }

  return {
    has: (firm) => firmKey(firm) in logins,
    get: (firm) => logins[firmKey(firm)] ?? null,
    set(firm, login) {
      logins[firmKey(firm)] = { username: login.username, password: login.password }
      save()
    },
    forget(firm) {
      delete logins[firmKey(firm)]
      save()
    },
    firms: () => Object.keys(logins),
  }
}
