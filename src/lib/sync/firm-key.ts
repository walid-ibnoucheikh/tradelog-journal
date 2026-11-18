import { createHash } from "node:crypto"

/** "Lucid", "lucid " and "LUCID" are one prop firm, so one Tradovate login. Same rule as agent/firm.mjs. */
export function firmKey(firm: string): string {
  return firm
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

/**
 * The key of an additional Tradovate login of a prop firm ("firm:" and a short fingerprint of the
 * username, so the username itself never appears in a key). The default login's key is the firm.
 */
export function extraLoginKey(firm: string, username: string): string {
  const fingerprint = createHash("sha256").update(username.trim().toLowerCase()).digest("hex")
  return `${firmKey(firm)}:${fingerprint.slice(0, 8)}`
}

/** Whether a login key belongs to a prop firm (its default login or one of its additional ones). */
export const loginBelongsTo = (key: string, firm: string) =>
  key === firmKey(firm) || key.startsWith(`${firmKey(firm)}:`)

/** The login an account uses: the one it points to, else the default one of its prop firm. */
export function accountLoginKey(account: { firm: string; loginKey?: string | null }): string {
  return account.loginKey || firmKey(account.firm)
}
