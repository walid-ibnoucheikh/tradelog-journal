/**
 * One sync request, handled in a GitHub runner. Free of side effects: the app's API, the vault, the
 * browser and the Tradovate steps are all passed in, so it can be tested with fakes.
 *
 * It never asks anything: when it cannot go on, it says so to the app, which shows it to you.
 */
import {
  AccountNotFoundError,
  LoginFailedError,
  NeedsLoginError,
  isClosedError,
  isTimeoutError,
} from "./tradovate.mjs"

/** An account that times out on a slow page gets one more try: reports sometimes load late. */
const MAX_ATTEMPTS = 2

/** The app keeps at most this many characters of a message: the list drops its successes first. */
export const MESSAGE_LIMIT = 3900

/** The technical lines kept under a failure (a Playwright "Call log", say): enough to diagnose. */
const DETAIL_LINES = 10
const DETAIL_WIDTH = 200

/**
 * A failure as a short sentence for the app, and the technical lines behind it for its "details"
 * fold: the first line of an error is what happened, the rest is a log that only helps a developer.
 */
export function describeFailure(error) {
  const [first = "", ...rest] = String(error?.message ?? error).split("\n")
  const detail = rest
    .map((line) => line.trim().slice(0, DETAIL_WIDTH))
    .filter((line) => line !== "")
    .slice(0, DETAIL_LINES)
  const text = isTimeoutError(error)
    ? `Tradovate did not respond as expected (${first.trim().replace(/\.$/, "")})`
    : first.trim()
  return { text, detail }
}

const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`

/** "2 new fills, 1 new fee" for what an upload imported (it holds one account in practice). */
function describeUpload({ summary }) {
  const imported = summary.imported ?? []
  if (imported.length === 0) return "nothing to import"
  const fills = imported.reduce((sum, item) => sum + item.newFills, 0)
  const fees = imported.reduce((sum, item) => sum + item.newFees, 0)
  return `${plural(fills, "new fill")}, ${plural(fees, "new fee")}`
}

/**
 * What the app shows after a sync: a summary line, then one line per account or prop firm, the ones
 * that need you first. `results` holds `{ kind, name, count, text }`:
 *   synced   an account imported (or with nothing to import)
 *   failed   an account that failed, or a whole prop firm (`count` accounts) for another reason
 *   login    a prop firm (`count` accounts) that needs its login or browser state renewed
 * The status follows the worst: a failure is "failed", a login is "needs_login", else "done".
 */
export function formatOutcome(results) {
  const count = (kind) =>
    results.filter((result) => result.kind === kind).reduce((sum, result) => sum + result.count, 0)
  const synced = count("synced")
  const logins = count("login")
  const failed = count("failed")
  const total = synced + logins + failed
  const status = failed > 0 ? "failed" : logins > 0 ? "needs_login" : "done"

  const parts = [
    synced === total
      ? total === 1
        ? "1 account synced"
        : `All ${total} accounts synced`
      : `${synced} of ${plural(total, "account")} synced`,
  ]
  if (logins > 0) parts.push(`${logins} need${logins === 1 ? "s" : ""} a new login`)
  if (failed > 0) parts.push(`${failed} failed`)
  const summary = parts.join(" · ")

  const line = (result) => {
    const who = result.count > 1 ? `${result.name} (${result.count} accounts)` : result.name
    const mark = { synced: "✓", login: "⚠", failed: "✗" }[result.kind]
    // The technical lines go indented under their line: the app folds them away.
    const detail = (result.detail ?? []).map((text) => `  ${text}`)
    return [`${mark} ${who}: ${result.text}`, ...detail].join("\n")
  }
  const problems = results.filter((result) => result.kind !== "synced").map(line)
  const successes = results.filter((result) => result.kind === "synced").map(line)

  const join = (...lines) => lines.join("\n")
  let message = join(summary, ...problems, ...successes)
  if (message.length > MESSAGE_LIMIT) {
    // Keep every problem; drop successes until it fits, and say how many are left out.
    const kept = [...successes]
    let dropped = 0
    const fits = () => join(summary, ...problems, ...kept, "… and 999 more synced").length
    while (kept.length > 0 && fits() > MESSAGE_LIMIT) {
      kept.pop()
      dropped++
    }
    message = join(summary, ...problems, ...kept, `… and ${dropped} more synced`)
    message = message.slice(0, MESSAGE_LIMIT)
  }
  return { status, message }
}

/**
 * @param {object} deps
 * @param {{ upload: Function, finish: Function }} deps.api the app's sync routes
 * @param {{ get: (firm: string) => ({ login: object | null, state: object | null } | null) }} deps.vault
 * @param {(firm: string, state: object | null) => Promise<{ page: object, close: () => Promise<void> }>} deps.openFirm
 * @param {{ ensureLoggedIn: Function, autoLogin: Function, exportAccount: Function }} deps.tradovate
 * @param {(message: string) => void} deps.log
 * @param {number} [deps.retryDelayMs] pause before the second try
 * @returns {Promise<string>} the status sent to the app: done, needs_login, failed or cancelled
 */
export async function runCloudRequest({
  api,
  request,
  vault,
  openFirm,
  tradovate,
  log,
  retryDelayMs = 3000,
}) {
  const started = Date.now()
  const results = []
  const presence = { found: [], missing: [], empty: [] }
  let cancelled = false

  /** The export of one account, tried again once when the page was too slow. */
  async function exportWithRetry(page, account) {
    for (let attempt = 1; ; attempt++) {
      try {
        const files = await tradovate.exportAccount(page, account.tradovateName, account)
        return { files, retried: attempt > 1 }
      } catch (error) {
        if (attempt >= MAX_ATTEMPTS || !isTimeoutError(error)) throw error
        log(`${account.name}: ${error.message.split("\n")[0]} Trying again.`)
        logDiagnostic(account, error)
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs))
      }
    }
  }

  /** Logs what the page showed when an export failed (set by exportAccount): address, tabs, screenshot. */
  function logDiagnostic(account, error) {
    const { url, tabs = [], screenshot } = error.diagnostic ?? {}
    if (!url) return
    log(
      `${account.name}: page ${url}; tabs seen: ${tabs.join(" | ") || "none"}` +
        (screenshot ? `; screenshot ${screenshot}` : "")
    )
  }

  /**
   * The accounts that share one Tradovate login (one browser session). Usually all the accounts of a
   * prop firm; an account on another login of the same firm forms its own group.
   */
  async function syncFirm(accounts, { second = false } = {}) {
    const firm = accounts[0].firm
    const loginKey = accounts[0].loginKey ?? firm
    // "Apex" for the firm's default login, "Apex · second" for an additional one.
    const title = loginKey.includes(":") ? `${firm} · ${loginKey.split(":")[1]}` : firm
    // The accounts of a firm that could not be reached at all: one line for the whole firm.
    const wholeFirm = (kind, text, count = accounts.length, detail = []) =>
      results.push({ kind, name: title, count, text, detail })

    const entry = vault.get(firm, loginKey)
    if (!entry) {
      wholeFirm(
        "login",
        "no Tradovate login saved for this prop firm. Save it in Import > Tradovate logins."
      )
      return
    }
    // Where the login comes from (never the login itself), to read in the run's log.
    log(
      `${title}: login from ${entry.login ? `the ${entry.source ?? "vault"}` : "nowhere (browser state only)"}.`
    )
    let session
    try {
      session = await openFirm(firm, entry.state)
      const { page } = session
      try {
        await tradovate.ensureLoggedIn(page)
      } catch (error) {
        if (!(error instanceof NeedsLoginError)) throw error
        if (!entry.login) {
          wholeFirm(
            "login",
            "the session is closed and no Tradovate login is saved for this prop firm. Save it in Import > Tradovate logins."
          )
          return
        }
        await tradovate.autoLogin(page, entry.login)
      }
      for (const [index, account] of accounts.entries()) {
        if (cancelled) return
        try {
          const { files, retried } = await exportWithRetry(page, account)
          presence.found.push(account.id)
          if (!files.fills && !files.cash) {
            presence.empty.push(account.id)
            results.push({
              kind: "synced",
              name: account.name,
              count: 1,
              text: "no activity in the period" + (retried ? " (after a retry)" : ""),
            })
            continue
          }
          const result = await api.upload(request.id, files)
          if (result.cancelled) {
            cancelled = true
            return
          }
          results.push({
            kind: "synced",
            name: account.name,
            count: 1,
            text: describeUpload(result) + (retried ? " (after a retry)" : ""),
          })
          log(`${account.name}: ${account.from} → ${account.to}`)
        } catch (error) {
          const notFound = error instanceof AccountNotFoundError
          if (notFound) presence.missing.push(account.id)
          const failure = notFound
            ? { text: `not found in Tradovate (${account.tradovateName})`, detail: [] }
            : describeFailure(error)
          results.push({ kind: "failed", name: account.name, count: 1, ...failure })
          log(`${account.name}: ${error.message}`)
          logDiagnostic(account, error)
          if (isClosedError(error)) {
            // The browser is gone: the accounts after this one cannot be tried.
            const rest = accounts.length - index - 1
            if (rest > 0) wholeFirm("failed", "not tried, the browser closed: retry", rest)
            return
          }
        }
      }
    } catch (error) {
      if (error instanceof NeedsLoginError || error instanceof LoginFailedError) {
        if (!second) {
          // Tradovate sometimes turns a login away when several arrive at once from the same address: it
          // gets one more try, alone, once the other firms are done.
          log(
            `${title}: Tradovate refused the login (${error.message.split("\n")[0]}) Trying again later.`
          )
          loginRefused.push(accounts)
          return
        }
        wholeFirm(
          "login",
          `Tradovate would not let the cloud in (${error.message}) Check the login saved in Import > Tradovate logins. If it is right, the browser state may have expired: run "npm run agent:export-cloud -- --no-logins" with your prop firms on your PC and update the secret.`
        )
      } else if (isClosedError(error)) {
        wholeFirm("failed", "the browser closed during the sync: retry")
      } else {
        const { text, detail } = describeFailure(error)
        wholeFirm("failed", text, accounts.length, detail)
        log(`${title}: ${error.message}`)
      }
    } finally {
      await session?.close().catch(() => {})
    }
  }

  // One session per Tradovate login: the accounts of a firm that share its login go together.
  const loginRefused = []
  const byFirm = Map.groupBy(request.accounts, (account) => account.loginKey ?? account.firm)
  await Promise.all([...byFirm.values()].map((accounts) => syncFirm(accounts)))
  // A refused login is tried once more, one firm at a time, after a pause.
  for (const accounts of loginRefused) {
    if (cancelled) break
    await new Promise((resolve) => setTimeout(resolve, retryDelayMs * 3))
    await syncFirm(accounts, { second: true })
  }
  if (cancelled) return "cancelled"

  const { status, message } = formatOutcome(results)
  await api.finish(request.id, status, message, presence)
  log(`Request finished in ${((Date.now() - started) / 1000).toFixed(1)} s: ${status}.`)
  return status
}
