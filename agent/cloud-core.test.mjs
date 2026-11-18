import { describe, expect, it, vi } from "vitest"
import { openCloudVault, packCloudVault, withAppLogins } from "./cloud-vault.mjs"
import { MESSAGE_LIMIT, describeFailure, formatOutcome, runCloudRequest } from "./cloud-core.mjs"
import {
  AccountNotFoundError,
  LoginFailedError,
  NeedsLoginError,
  isClosedError,
  isTimeoutError,
} from "./tradovate.mjs"

const state = { cookies: [], origins: [] }
const vault = openCloudVault(
  packCloudVault([
    { firm: "Tradeify", login: { username: "u", password: "p" }, state },
    { firm: "Lucid", login: null, state },
  ])
)
const account = (id, firm) => ({
  id,
  name: `${firm} ${id}`,
  firm,
  tradovateName: `T-${id}`,
  from: "2026-10-28",
  to: "2026-11-04",
})
const request = (...accounts) => ({ id: "req-1", accounts })

function setup(overrides = {}) {
  const api = {
    upload: vi.fn(async () => ({
      summary: { imported: [{ account: "A", newFills: 2, newFees: 1 }] },
    })),
    finish: vi.fn(async () => {}),
  }
  const close = vi.fn(async () => {})
  const tradovate = {
    ensureLoggedIn: vi.fn(async () => {}),
    autoLogin: vi.fn(async () => {}),
    exportAccount: vi.fn(async () => ({ fills: "a,b\n1,2\n3,4\n5,6", cash: undefined })),
    ...overrides,
  }
  const openFirm = vi.fn(async () => ({ page: {}, close }))
  const logs = []
  const run = (req) =>
    runCloudRequest({
      api,
      request: req,
      vault,
      openFirm,
      tradovate,
      log: (message) => logs.push(message),
      retryDelayMs: 0,
    })
  return { api, close, tradovate, openFirm, run, logs }
}

describe("runCloudRequest", () => {
  it("exports each account, sends the files and finishes as done", async () => {
    const { api, run, openFirm, close } = setup()
    expect(await run(request(account("1", "Tradeify"), account("2", "Tradeify")))).toBe("done")
    expect(openFirm).toHaveBeenCalledTimes(1) // one browser per prop firm
    expect(openFirm).toHaveBeenCalledWith("Tradeify", state)
    expect(api.upload).toHaveBeenCalledTimes(2)
    const [id, status, message, found] = api.finish.mock.calls[0].flatMap((x) => x)
    expect([id, status]).toEqual(["req-1", "done"])
    expect(message).toContain("2 new fills")
    expect(found).toBeDefined()
    expect(close).toHaveBeenCalled()
  })

  it("logs in with the vault login when the saved state is not enough", async () => {
    const { tradovate, run } = setup({
      ensureLoggedIn: vi.fn(async () => {
        throw new NeedsLoginError("login form")
      }),
    })
    expect(await run(request(account("1", "Tradeify")))).toBe("done")
    expect(tradovate.autoLogin).toHaveBeenCalledWith({}, { username: "u", password: "p" })
  })

  it("asks for a new export when Tradovate refuses the login", async () => {
    const { api, run } = setup({
      ensureLoggedIn: vi.fn(async () => {
        throw new NeedsLoginError("login form")
      }),
      autoLogin: vi.fn(async () => {
        throw new LoginFailedError("refused")
      }),
    })
    expect(await run(request(account("1", "Tradeify")))).toBe("needs_login")
    expect(api.finish.mock.calls[0][2]).toContain("Import > Tradovate logins")
    expect(api.upload).not.toHaveBeenCalled()
  })

  it("needs a login when the firm has a state but no login and the session is gone", async () => {
    const { api, run } = setup({
      ensureLoggedIn: vi.fn(async () => {
        throw new NeedsLoginError("login form")
      }),
    })
    expect(await run(request(account("1", "Lucid")))).toBe("needs_login")
    expect(api.finish.mock.calls[0][1]).toBe("needs_login")
    expect(api.finish.mock.calls[0][2]).toContain("Import > Tradovate logins")
  })

  it("says so when the prop firm is not in the vault", async () => {
    const { api, run, openFirm } = setup()
    expect(await run(request(account("1", "Apex")))).toBe("needs_login")
    expect(openFirm).not.toHaveBeenCalled()
    expect(api.finish.mock.calls[0][2]).toContain("no Tradovate login saved")
  })

  it("reports an account missing from Tradovate and keeps going with the others", async () => {
    const exportAccount = vi.fn(async (_page, name) => {
      if (name === "T-1") throw new AccountNotFoundError("T-1 is not in this Tradovate login.")
      return { fills: "a,b\n1,2", cash: undefined }
    })
    const { api, run } = setup({ exportAccount })
    expect(await run(request(account("1", "Tradeify"), account("2", "Tradeify")))).toBe("failed")
    expect(api.upload).toHaveBeenCalledTimes(1)
    expect(api.finish.mock.calls[0][3]).toEqual({
      found: ["2"],
      missing: ["1"],
      empty: [],
    })
  })

  it("reports an account exported with nothing to import as empty, not as missing", async () => {
    const exportAccount = vi.fn(async () => ({ fills: undefined, cash: undefined }))
    const { api, run } = setup({ exportAccount })
    expect(await run(request(account("1", "Tradeify")))).toBe("done")
    expect(api.upload).not.toHaveBeenCalled()
    expect(api.finish.mock.calls[0][3]).toEqual({ found: ["1"], missing: [], empty: ["1"] })
  })

  it("stops quietly when the request was cancelled meanwhile", async () => {
    const { api, run } = setup()
    api.upload.mockResolvedValueOnce({ cancelled: true })
    expect(await run(request(account("1", "Tradeify"), account("2", "Tradeify")))).toBe("cancelled")
    expect(api.upload).toHaveBeenCalledTimes(1)
    expect(api.finish).not.toHaveBeenCalled()
  })

  it("never puts a login in the message sent to the app", async () => {
    const { api, run } = setup({
      exportAccount: vi.fn(async () => {
        throw new Error("boom")
      }),
    })
    await run(request(account("1", "Tradeify")))
    expect(JSON.stringify(api.finish.mock.calls)).not.toMatch(/"p"|password/)
  })
})

describe("accounts on different Tradovate logins of one firm", () => {
  const onLogin = (id, loginKey) => ({ ...account(id, "Tradeify"), loginKey })

  it("opens one session per login and logs which one each account used", async () => {
    const { api, run, openFirm, logs } = setup({
      exportAccount: vi.fn(async (_page, name) => {
        if (name === "T-3") throw new Error("the reports page did not load")
        return { fills: "a,b\n1,2", cash: undefined }
      }),
    })
    await run(
      request(onLogin("1", "tradeify"), onLogin("2", "tradeify"), onLogin("3", "tradeify:second"))
    )
    expect(openFirm).toHaveBeenCalledTimes(2)
    const message = api.finish.mock.calls[0][2]
    expect(message).toContain("✗ Tradeify 3: the reports page did not load")
    expect(message).toContain("✓ Tradeify 1")
    expect(logs).toContain("Tradeify · second: login from the vault.")
  })

  it("groups accounts of one firm spelled differently when the app gives them one login", async () => {
    const { run, openFirm } = setup()
    await run(request(onLogin("1", "tradeify"), { ...onLogin("2", "tradeify"), firm: "tradeify " }))
    expect(openFirm).toHaveBeenCalledTimes(1)
  })
})

describe("where the login comes from", () => {
  it("logs the source of the login, never the login", async () => {
    const { run, logs } = setup()
    await run(request(account("1", "Tradeify"), account("2", "Lucid")))
    expect(logs).toContain("Tradeify: login from the vault.")
    expect(logs).toContain("Lucid: login from nowhere (browser state only).")
    expect(logs.join("\n")).not.toMatch(/"p"|password/)
  })
})

describe("cloud vault", () => {
  it("round-trips and finds a firm however it is written", () => {
    expect(vault.get("TRADEIFY ")?.login).toEqual({ username: "u", password: "p" })
    expect(vault.get("lucid")?.login).toBeNull()
    expect(vault.get("apex")).toBeNull()
    expect(vault.firms()).toEqual(["tradeify", "lucid"])
  })

  it("completes the vault with the logins saved in the app", () => {
    const app = withAppLogins(vault, { apex: { username: "a", password: "b" } })
    // Apex is not in the vault: it gets its saved login and a state borrowed from another firm.
    expect(app.get("Apex", "apex")?.login).toEqual({ username: "a", password: "b" })
    expect(app.get("Apex", "apex")?.state).toEqual(vault.deviceState())
    expect(vault.deviceState()).not.toBeNull()
    // A firm of the vault with no saved login is left as it is; a saved login replaces the vault's.
    expect(app.get("Apex", "apex")?.source).toBe("app")
    expect(app.get("Tradeify")).toEqual({ ...vault.get("Tradeify"), source: "vault" })
    const replaced = withAppLogins(vault, { tradeify: { username: "new", password: "pw" } })
    expect(replaced.get("Tradeify", "tradeify")?.login).toEqual({ username: "new", password: "pw" })
    expect(replaced.get("Tradeify", "tradeify")?.source).toBe("app")
    expect(replaced.get("Tradeify", "tradeify")?.state).toEqual(vault.get("Tradeify")?.state)
    // An empty or missing saved login is ignored.
    expect(withAppLogins(vault, {}).get("Apex", "apex")).toBeNull()
    expect(withAppLogins(vault, undefined).get("Apex", "apex")).toBeNull()
  })

  it("rejects a missing or broken secret without quoting it", () => {
    expect(() => openCloudVault("")).toThrow(/empty or missing/)
    expect(() => openCloudVault("nonsense!")).toThrow(/not a valid packed vault/)
  })
})

describe("a refused login", () => {
  it("is tried once more, alone, and the sync then goes through", async () => {
    let calls = 0
    const { api, run, openFirm, logs } = setup({
      ensureLoggedIn: vi.fn(async () => {
        throw new NeedsLoginError("login form")
      }),
      autoLogin: vi.fn(async () => {
        calls++
        if (calls === 1) throw new LoginFailedError("refused")
      }),
    })
    expect(await run(request(account("1", "Tradeify")))).toBe("done")
    expect(openFirm).toHaveBeenCalledTimes(2)
    expect(logs.some((line) => line.includes("Trying again later"))).toBe(true)
    expect(api.finish.mock.calls[0][2]).toContain("✓ Tradeify 1")
    expect(api.finish.mock.calls[0][2]).not.toContain("would not let the cloud in")
  })

  it("is reported once, not twice, when the second try is refused too", async () => {
    const { api, run, openFirm } = setup({
      ensureLoggedIn: vi.fn(async () => {
        throw new NeedsLoginError("login form")
      }),
      autoLogin: vi.fn(async () => {
        throw new LoginFailedError("refused")
      }),
    })
    expect(await run(request(account("1", "Tradeify")))).toBe("needs_login")
    expect(openFirm).toHaveBeenCalledTimes(2)
    const lines = api.finish.mock.calls[0][2].split("\n")
    expect(lines.filter((line) => line.includes("would not let the cloud in"))).toHaveLength(1)
  })

  it("does not hold back the firms that got in: they are done before the second try", async () => {
    const order = []
    const { run } = setup({
      ensureLoggedIn: vi.fn(async () => {}),
      autoLogin: vi.fn(async () => {}),
      exportAccount: vi.fn(async (_page, name) => {
        order.push(name)
        return { fills: "a,b\n1,2", cash: undefined }
      }),
    })
    expect(await run(request(account("1", "Tradeify"), account("2", "Lucid")))).toBe("done")
    expect(order).toHaveLength(2)
  })
})

describe("runCloudRequest with many accounts", () => {
  it("tells apart what synced, what failed and what needs a login, one line each", async () => {
    const exportAccount = vi.fn(async (_page, name) => {
      if (name === "T-3") throw new Error("the reports page did not load")
      if (name === "T-4") throw new AccountNotFoundError("T-4 is not in this Tradovate login.")
      return { fills: "a,b\n1,2\n3,4\n5,6", cash: undefined }
    })
    const { api, run } = setup({ exportAccount })
    const accounts = [
      account("1", "Tradeify"),
      account("2", "Tradeify"),
      account("3", "Tradeify"),
      account("4", "Tradeify"),
      account("5", "Apex"), // not in the vault: needs a login
      account("6", "Apex"),
    ]
    expect(await run(request(...accounts))).toBe("failed")
    const [, status, message, presence] = api.finish.mock.calls[0]
    expect(status).toBe("failed")
    const lines = message.split("\n")
    expect(lines[0]).toBe("2 of 6 accounts synced · 2 need a new login · 2 failed")
    // What needs you comes first, successes last.
    expect(lines.findIndex((line) => line.startsWith("✓"))).toBeGreaterThan(
      lines.findLastIndex((line) => line.startsWith("✗") || line.startsWith("⚠"))
    )
    expect(message).toContain("⚠ Apex (2 accounts): no Tradovate login saved")
    expect(message).toContain("✗ Tradeify 3: the reports page did not load")
    expect(message).toContain("✗ Tradeify 4: not found in Tradovate (T-4)")
    expect(message).toContain("✓ Tradeify 1: 2 new fills, 1 new fee")
    expect(presence.missing).toEqual(["4"])
  })

  it("stops a firm whose browser closed and says how many accounts were not tried", async () => {
    const exportAccount = vi.fn(async () => {
      throw new Error("Target closed")
    })
    const { api, run } = setup({ exportAccount })
    expect(
      await run(
        request(account("1", "Tradeify"), account("2", "Tradeify"), account("3", "Tradeify"))
      )
    ).toBe("failed")
    expect(exportAccount).toHaveBeenCalledTimes(1)
    const message = api.finish.mock.calls[0][2]
    expect(message).toContain("✗ Tradeify 1: Target closed")
    expect(message).toContain("✗ Tradeify (2 accounts): not tried, the browser closed: retry")
  })
})

describe("formatOutcome", () => {
  const synced = (name, text = "1 new fill, 0 new fees") => ({
    kind: "synced",
    name,
    count: 1,
    text,
  })

  it("says all accounts are synced, or just one account", () => {
    expect(formatOutcome([synced("A")])).toEqual({
      status: "done",
      message: "1 account synced\n✓ A: 1 new fill, 0 new fees",
    })
    expect(formatOutcome([synced("A"), synced("B")]).message.split("\n")[0]).toBe(
      "All 2 accounts synced"
    )
  })

  it("is needs_login for a login alone, failed as soon as something failed", () => {
    const login = { kind: "login", name: "Lucid", count: 3, text: "renew it" }
    expect(formatOutcome([synced("A"), login]).status).toBe("needs_login")
    expect(formatOutcome([login, { kind: "failed", name: "B", count: 1, text: "x" }]).status).toBe(
      "failed"
    )
    expect(formatOutcome([login]).message.split("\n")[0]).toBe(
      "0 of 3 accounts synced · 3 need a new login"
    )
  })

  it("drops successes, never problems, when the message would be too long", () => {
    const many = Array.from({ length: 400 }, (_, i) => synced(`Account number ${i}`))
    const problem = { kind: "failed", name: "Broken", count: 1, text: "boom" }
    const { message } = formatOutcome([...many, problem])
    expect(message.length).toBeLessThanOrEqual(MESSAGE_LIMIT)
    expect(message).toContain("✗ Broken: boom")
    expect(message).toMatch(/… and \d+ more synced$/)
  })
})

describe("isClosedError", () => {
  it("recognises a closed browser or page, and nothing else", () => {
    expect(isClosedError(new Error("Target page, context or browser has been closed"))).toBe(true)
    expect(isClosedError(new Error("Browser closed"))).toBe(true)
    expect(isClosedError(new Error("Tradovate did not accept the login"))).toBe(false)
  })
})

const timeout = (message = "locator.click: Timeout 30000ms exceeded.") =>
  Object.assign(new Error(message), { name: "TimeoutError" })

describe("runCloudRequest retries and diagnostics", () => {
  it("tries an account again once when the page was too slow, and says so", async () => {
    const exportAccount = vi
      .fn()
      .mockRejectedValueOnce(timeout())
      .mockResolvedValue({ fills: "a,b\n1,2\n3,4\n5,6", cash: undefined })
    const { api, run, logs } = setup({ exportAccount })
    expect(await run(request(account("1", "Tradeify")))).toBe("done")
    expect(exportAccount).toHaveBeenCalledTimes(2)
    expect(api.finish.mock.calls[0][2]).toContain("(after a retry)")
    expect(logs.some((line) => line.includes("Trying again"))).toBe(true)
  })

  it("fails after the second timeout, logging what the page showed", async () => {
    const failure = () =>
      Object.assign(timeout(), {
        diagnostic: { url: "https://trader.tradovate.com/", tabs: ["Positions", "Orders"] },
      })
    const exportAccount = vi.fn(async () => {
      throw failure()
    })
    const { api, run, logs } = setup({ exportAccount })
    expect(await run(request(account("1", "Tradeify")))).toBe("failed")
    expect(exportAccount).toHaveBeenCalledTimes(2)
    expect(api.finish.mock.calls[0][2]).toContain(
      "✗ Tradeify 1: Tradovate did not respond as expected (locator.click"
    )
    expect(logs.some((line) => line.includes("tabs seen: Positions | Orders"))).toBe(true)
  })

  it("does not retry what a second try cannot fix", async () => {
    const generic = vi.fn(async () => {
      throw new Error("the reports page did not load")
    })
    expect(await setup({ exportAccount: generic }).run(request(account("1", "Tradeify")))).toBe(
      "failed"
    )
    expect(generic).toHaveBeenCalledTimes(1)

    const missing = vi.fn(async () => {
      throw new AccountNotFoundError("T-1 is not in this Tradovate login.")
    })
    await setup({ exportAccount: missing }).run(request(account("1", "Tradeify")))
    expect(missing).toHaveBeenCalledTimes(1)
  })
})

describe("isTimeoutError", () => {
  it("recognises Playwright's timeout, and nothing else", () => {
    expect(isTimeoutError(timeout())).toBe(true)
    expect(isTimeoutError(new Error("Timeout of the cloud"))).toBe(false)
    expect(isTimeoutError(undefined)).toBe(false)
  })
})

describe("describeFailure", () => {
  const timeout = () => {
    const error = new Error(
      [
        "locator.selectOption: Timeout 30000ms exceeded.",
        "Call log:",
        "- waiting for locator('select.form-control').first()",
        "- retrying select option action",
      ].join("\n")
    )
    error.name = "TimeoutError"
    return error
  }

  it("turns a Playwright timeout into a short sentence, and keeps its log apart", () => {
    expect(describeFailure(timeout())).toEqual({
      text: "Tradovate did not respond as expected (locator.selectOption: Timeout 30000ms exceeded)",
      detail: [
        "Call log:",
        "- waiting for locator('select.form-control').first()",
        "- retrying select option action",
      ],
    })
  })

  it("keeps the first line of any other error, with no detail for a one-line error", () => {
    expect(describeFailure(new Error("boom"))).toEqual({ text: "boom", detail: [] })
  })

  it("keeps the log short", () => {
    const long = new Error(["x", ...Array.from({ length: 50 }, () => "y".repeat(500))].join("\n"))
    const { detail } = describeFailure(long)
    expect(detail).toHaveLength(10)
    expect(detail[0]).toHaveLength(200)
  })
})

describe("formatOutcome with a failure detail", () => {
  it("indents the detail under its failed line", () => {
    const { message } = formatOutcome([
      { kind: "failed", name: "A", count: 1, text: "slow", detail: ["Call log:", "- x"] },
      { kind: "synced", name: "B", count: 1, text: "ok" },
    ])
    expect(message).toBe(
      "1 of 2 accounts synced · 1 failed\n✗ A: slow\n  Call log:\n  - x\n✓ B: ok"
    )
  })
})
