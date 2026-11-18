/**
 * Encryption of the Tradovate logins kept in the database (AES-256-GCM). The key lives in the
 * environment (`CREDENTIALS_KEY`, 32 random bytes in base64), never in the database: a copy of the
 * database or of a backup alone does not give the passwords. Each secret is bound to its row (the
 * prop firm key) so that a ciphertext moved to another row does not open.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"

const VERSION = "v1"
const KEY_BYTES = 32

export interface TradovateLogin {
  username: string
  password: string
}

/** The key from the environment, or null when it is missing or not 32 bytes of base64. */
export function loadCredentialsKey(env: Record<string, string | undefined> = process.env) {
  const text = env.CREDENTIALS_KEY?.trim()
  if (!text) return null
  const key = Buffer.from(text, "base64")
  return key.length === KEY_BYTES ? key : null
}

/** `v1.iv.tag.ciphertext`, each part in base64. */
export function encryptLogin(login: TradovateLogin, boundTo: string, key: Buffer): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  cipher.setAAD(Buffer.from(boundTo))
  const data = Buffer.concat([cipher.update(JSON.stringify(login), "utf8"), cipher.final()])
  const [ivText, tagText, dataText] = [iv, cipher.getAuthTag(), data].map((part) =>
    part.toString("base64")
  )
  return [VERSION, ivText, tagText, dataText].join(".")
}

/** The login, or null when the text is not valid, the key is wrong or the secret belongs to another row. */
export function decryptLogin(secret: string, boundTo: string, key: Buffer): TradovateLogin | null {
  const parts = secret.split(".")
  if (parts.length !== 4 || parts[0] !== VERSION) return null
  const [, iv, tag, data] = parts
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"))
    decipher.setAAD(Buffer.from(boundTo))
    decipher.setAuthTag(Buffer.from(tag, "base64"))
    const text = Buffer.concat([
      decipher.update(Buffer.from(data, "base64")),
      decipher.final(),
    ]).toString("utf8")
    const login = JSON.parse(text) as Partial<TradovateLogin>
    return typeof login.username === "string" && typeof login.password === "string"
      ? { username: login.username, password: login.password }
      : null
  } catch {
    return null
  }
}
