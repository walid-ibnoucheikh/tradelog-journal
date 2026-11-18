/**
 * The account chosen in a page's filter is kept for the rest of the visit, so the other pages open on it.
 * It lives in sessionStorage: it is gone when the tab closes, so the app always opens on the active accounts.
 */
export const ACCOUNT_KEY = "tradelog.account"
const ACCOUNT_EVENT = "tradelog-account"

/** The pages that have an account filter (the others, such as Investments or Import, are not filtered). */
const FILTERED_PAGES = new Set(["/", "/trades", "/journal", "/reports"])

/** A menu address carrying the remembered account, for the pages that have an account filter. */
export function withAccount(href: string, account: string | null): string {
  if (!account || !FILTERED_PAGES.has(href)) return href
  return `${href}?account=${encodeURIComponent(account)}`
}

export function readAccount(): string | null {
  try {
    return sessionStorage.getItem(ACCOUNT_KEY)
  } catch {
    return null
  }
}

/** Remembers the account ("all" for every account, a group or an id); null goes back to the default, the active accounts. */
export function rememberAccount(account: string | null) {
  try {
    if (account) sessionStorage.setItem(ACCOUNT_KEY, account)
    else sessionStorage.removeItem(ACCOUNT_KEY)
  } catch {
    // Storage blocked: the choice just is not remembered.
  }
  window.dispatchEvent(new Event(ACCOUNT_EVENT))
}

export function subscribeAccount(onChange: () => void) {
  window.addEventListener(ACCOUNT_EVENT, onChange)
  return () => window.removeEventListener(ACCOUNT_EVENT, onChange)
}
