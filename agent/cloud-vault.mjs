/**
 * What the cloud run needs per prop firm, as one GitHub secret (TRADELOG_CLOUD_VAULT): the login
 * and the browser state (see state.mjs), packed together. Made on this PC by
 * `npm run agent:export-cloud`, read in the GitHub runner. It holds passwords and session tokens:
 * it is never printed, logged or committed.
 */
import { firmKey } from "./firm.mjs"
import { packJson, unpackJson } from "./state.mjs"

/** `entries`: [{ firm, login: {username, password} | null, state | null }]. */
export function packCloudVault(entries) {
  const vault = {}
  for (const { firm, login, state } of entries) {
    vault[firmKey(firm)] = {
      username: login?.username ?? null,
      password: login?.password ?? null,
      state: state ?? null,
    }
  }
  return packJson(vault)
}

/** The vault of a packed secret, or an error that says what is wrong without quoting the secret. */
export function openCloudVault(text) {
  if (!text?.trim()) throw new Error("TRADELOG_CLOUD_VAULT is empty or missing.")
  let vault
  try {
    vault = unpackJson(text)
  } catch {
    throw new Error("TRADELOG_CLOUD_VAULT is not a valid packed vault.")
  }
  return {
    firms: () => Object.keys(vault),
    /**
     * A browser state to start from for a prop firm that has none of its own. Tradovate trusts a
     * browser, not a login: the state of any firm opens the login form of any other.
     */
    deviceState: () => Object.values(vault).find((entry) => entry.state)?.state ?? null,
    /** The firm's login and state, or null when the firm is not in the vault. */
    get(firm) {
      const entry = vault[firmKey(firm)]
      if (!entry) return null
      return {
        login:
          entry.username && entry.password
            ? { username: entry.username, password: entry.password }
            : null,
        state: entry.state ?? null,
      }
    },
  }
}

/**
 * The vault, completed by the logins saved in the app (`logins`, by login key). A saved login wins over the vault's; a firm that has no state of its own borrows one.
 */
export function withAppLogins(vault, logins = {}) {
  return {
    firms: vault.firms,
    /** `loginKey`: the saved login the accounts use (their own, else their prop firm's). */
    get(firm, loginKey = firm) {
      const own = vault.get(firm)
      const login = logins?.[loginKey]
      if (!login?.username || !login?.password) return own && { ...own, source: "vault" }
      return {
        source: "app",
        login: { username: login.username, password: login.password },
        state: own?.state ?? vault.deviceState(),
      }
    },
  }
}
