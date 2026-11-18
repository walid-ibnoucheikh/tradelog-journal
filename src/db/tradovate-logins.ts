import { eq } from "drizzle-orm"
import { db } from "@/db"
import { tradovateLogins } from "@/db/schema"
import {
  decryptLogin,
  encryptLogin,
  loadCredentialsKey,
  type TradovateLogin,
} from "@/lib/credentials/crypto"
import { extraLoginKey, firmKey, loginBelongsTo } from "@/lib/sync/firm-key"

/** Whether logins can be stored: `CREDENTIALS_KEY` is set and valid. */
export const loginStorageReady = () => loadCredentialsKey() !== null

function requireKey() {
  const key = loadCredentialsKey()
  if (!key) throw new Error("CREDENTIALS_KEY is missing or invalid.")
  return key
}

async function writeLogin(id: string, firm: string, label: string | null, login: TradovateLogin) {
  const secret = encryptLogin(login, id, requireKey())
  await db
    .insert(tradovateLogins)
    .values({ firmKey: id, firm: firm.trim(), label, secret })
    .onConflictDoUpdate({
      target: tradovateLogins.firmKey,
      set: { firm: firm.trim(), label, secret, updatedAt: new Date() },
    })
}

/** Saves (or replaces) a login under a key that already exists in the list (Import page). */
export async function saveLoginUnderKey(
  id: string,
  firm: string,
  label: string | null,
  login: TradovateLogin
) {
  if (!firmKey(firm) || !loginBelongsTo(id, firm)) throw new Error("Unknown login.")
  await writeLogin(id, firm, label, login)
}

/**
 * The login typed for an account of `firm`: the login of the firm that has this username is updated
 * (new password), else it becomes the firm's default login when there is none, else an additional
 * login. Returns the key to store on the account: null for the default login of the firm.
 */
export async function saveLoginForAccount(
  firm: string,
  login: TradovateLogin
): Promise<string | null> {
  const key = requireKey()
  const base = firmKey(firm)
  if (!base) throw new Error("A prop firm name is needed.")
  const rows = (await db.select().from(tradovateLogins)).filter((row) =>
    loginBelongsTo(row.firmKey, firm)
  )
  const same = rows.find(
    (row) =>
      decryptLogin(row.secret, row.firmKey, key)?.username.trim().toLowerCase() ===
      login.username.trim().toLowerCase()
  )
  if (same) {
    await writeLogin(same.firmKey, same.firm, same.label, login)
    return same.firmKey === base ? null : same.firmKey
  }
  if (!rows.some((row) => row.firmKey === base)) {
    await writeLogin(base, firm, null, login)
    return null
  }
  const id = extraLoginKey(firm, login.username)
  await writeLogin(id, firm, `login ${rows.length + 1}`, login)
  return id
}

/** Forgets a saved login, by its key. */
export async function removeTradovateLogin(id: string) {
  await db.delete(tradovateLogins).where(eq(tradovateLogins.firmKey, id))
}

/** The saved logins (who they are for, never the logins themselves). */
export async function listSavedLogins() {
  return db
    .select({
      key: tradovateLogins.firmKey,
      firm: tradovateLogins.firm,
      label: tradovateLogins.label,
      updatedAt: tradovateLogins.updatedAt,
    })
    .from(tradovateLogins)
}

/**
 * The saved logins of these keys, by key. A key with no login, or whose secret does not open, is
 * left out.
 */
export async function loginsForKeys(keys: string[]): Promise<Record<string, TradovateLogin>> {
  const key = loadCredentialsKey()
  if (!key || keys.length === 0) return {}
  const rows = await db.select().from(tradovateLogins)
  const secrets = new Map(rows.map((row) => [row.firmKey, row.secret]))
  const result: Record<string, TradovateLogin> = {}
  for (const id of new Set(keys)) {
    const secret = secrets.get(id)
    const login = secret ? decryptLogin(secret, id, key) : null
    if (login) result[id] = login
  }
  return result
}
