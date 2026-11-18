import type { TradovateLogin } from "./crypto"

const MAX_LENGTH = 200

/** The username and password typed in a form: nothing typed, a login, or an error to show. */
export function readLogin(
  username: string,
  password: string
): { none: true } | { login: TradovateLogin } | { error: string } {
  if (!username && !password) return { none: true }
  if (!username || !password) return { error: "Enter both the Tradovate username and password." }
  if (username.length > MAX_LENGTH || password.length > MAX_LENGTH) {
    return { error: "The Tradovate username or password is too long." }
  }
  return { login: { username, password } }
}

export const LOGIN_STORAGE_OFF =
  "Saving a Tradovate login is not set up: CREDENTIALS_KEY is missing in the app's environment."
