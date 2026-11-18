/**
 * Password protection, kept free of any Next.js import so it can be unit tested and used from the
 * proxy, Server Actions and pages alike. A session is a signed, expiring cookie (HMAC-SHA256).
 */

export const SESSION_COOKIE = "tradelog_session"
export const SESSION_DAYS = 30
export const MIN_PASSWORD_LENGTH = 12
export const MIN_SECRET_LENGTH = 32

const encoder = new TextEncoder()

export interface AuthEnv {
  APP_PASSWORD?: string
  SESSION_SECRET?: string
  NODE_ENV?: string
}

export type AuthStatus =
  | { mode: "disabled" }
  | { mode: "enabled"; password: string; secret: string }
  | { mode: "misconfigured"; reason: string }

/**
 * Whether the app asks for a password. Locally, with no password set, it stays open so development
 * is frictionless. Anywhere else (production, Vercel previews) a missing or weak setting locks the
 * whole app instead of leaving it open.
 */
export function authStatus(env: AuthEnv): AuthStatus {
  const password = env.APP_PASSWORD ?? ""
  const secret = env.SESSION_SECRET ?? ""
  if (!password && env.NODE_ENV !== "production") return { mode: "disabled" }
  if (!password) return { mode: "misconfigured", reason: "APP_PASSWORD is not set." }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      mode: "misconfigured",
      reason: `APP_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters long.`,
    }
  }
  if (secret.length < MIN_SECRET_LENGTH) {
    return {
      mode: "misconfigured",
      reason: `SESSION_SECRET must be at least ${MIN_SECRET_LENGTH} characters long.`,
    }
  }
  return { mode: "enabled", password, secret }
}

function toHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("")
}

function fromHex(hex: string): Uint8Array<ArrayBuffer> | null {
  if (!/^(?:[0-9a-f]{2})+$/.test(hex)) return null
  const bytes = new Uint8Array(new ArrayBuffer(hex.length / 2))
  for (let index = 0; index < bytes.length; index++) {
    bytes[index] = parseInt(hex.slice(index * 2, index * 2 + 2), 16)
  }
  return bytes
}

function signingKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  )
}

/** A cookie value proving the password was entered, valid for SESSION_DAYS. */
export async function createSessionToken(secret: string, now = Date.now()): Promise<string> {
  const payload = `v1.${now + SESSION_DAYS * 86_400_000}`
  const signature = await crypto.subtle.sign(
    "HMAC",
    await signingKey(secret),
    encoder.encode(payload)
  )
  return `${payload}.${toHex(signature)}`
}

/** True for an untampered, unexpired token signed with this secret. */
export async function verifySessionToken(
  secret: string,
  token: string | undefined,
  now = Date.now()
): Promise<boolean> {
  const parts = token?.split(".")
  if (!parts || parts.length !== 3 || parts[0] !== "v1" || !/^\d+$/.test(parts[1])) return false
  if (Number(parts[1]) <= now) return false
  const signature = fromHex(parts[2])
  if (!signature) return false
  return crypto.subtle.verify(
    "HMAC",
    await signingKey(secret),
    signature,
    encoder.encode(`${parts[0]}.${parts[1]}`)
  )
}

/** Compares two passwords without leaking where they differ: both are hashed to the same length first. */
export async function passwordMatches(input: string, expected: string): Promise<boolean> {
  const [a, b] = await Promise.all(
    [input, expected].map(
      async (value) => new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)))
    )
  )
  let difference = 0
  for (let index = 0; index < a.length; index++) difference |= a[index] ^ b[index]
  return difference === 0
}

/** The page to return to after logging in; anything that is not a plain path of this app becomes "/". */
export function safeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/"
  if (/[\u0000-\u001f]/.test(value) || value.startsWith("/login")) return "/"
  return value
}
