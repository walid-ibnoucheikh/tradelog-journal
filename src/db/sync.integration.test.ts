/**
 * Runs the sync queue and the cloud run's routes against a Neon database. Needs TEST_DATABASE_URL
 * (a dedicated Neon branch) and is skipped without it. It never touches DATABASE_URL.
 */
import { readFileSync } from "node:fs"
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

// Outside Next there is no cache to tag or drop: these calls only matter in the running app.
vi.mock("next/cache", () => ({
  cacheLife: () => {},
  cacheTag: () => {},
  revalidateTag: () => {},
  updateTag: () => {},
  refresh: () => {},
}))

try {
  process.loadEnvFile(".env.test.local")
} catch {
  // No local env file: rely on the process environment (CI).
}

const testUrl = process.env.TEST_DATABASE_URL
const hostOf = (url: string) => new URL(url).hostname
const TOKEN = "t".repeat(48)
const auth = { authorization: `Bearer ${TOKEN}` }

describe.skipIf(!testUrl)("sync (Neon test branch)", { timeout: 60_000 }, () => {
  let db: typeof import("@/db").db
  let schema: typeof import("@/db/schema")
  let sync: typeof import("@/db/sync")
  let accountId = ""
  let tradovateName = ""
  const ids: string[] = []

  beforeAll(async () => {
    if (process.env.DATABASE_URL && hostOf(process.env.DATABASE_URL) === hostOf(testUrl!)) {
      throw new Error("TEST_DATABASE_URL points at the same database as DATABASE_URL")
    }
    process.env.DATABASE_URL = testUrl
    process.env.SYNC_TOKEN = TOKEN
    process.env.CREDENTIALS_KEY = Buffer.alloc(32, 7).toString("base64")
    ;({ db } = await import("@/db"))
    schema = await import("@/db/schema")
    sync = await import("@/db/sync")
    // Nothing else may be waiting, or the queue under test would not be ours.
    await db.delete(schema.syncRequests)
    tradovateName = `SYNCTEST${Date.now()}`
    const [account] = await db
      .insert(schema.accounts)
      .values({
        name: "Sync test",
        firm: "TestFirm",
        tradovateName,
        initialBalance: 50000,
      })
      .returning()
    accountId = account.id
  })

  afterAll(async () => {
    await db.delete(schema.syncRequests)
    if (accountId) await db.delete(schema.accounts).where(eq(schema.accounts.id, accountId))
  })

  it("keeps one open request and hands it to the cloud run once", async () => {
    const first = await sync.requestSync()
    ids.push(first.id)
    const again = await sync.requestSync({ accountId })
    expect(again.id).toBe(first.id)

    const claimed = (await sync.claimNextRequest()).request
    expect(claimed?.id).toBe(first.id)
    expect(claimed?.status).toBe("running")
    expect((await sync.claimNextRequest()).request).toBeNull()
  })

  it("lists the active accounts with a window, and closes the request once", async () => {
    const [running] = await db.select().from(schema.syncRequests)
    const targets = await sync.syncTargets(running)
    const ours = targets.find((target) => target.id === accountId)
    expect(ours?.firm).toBe("TestFirm")
    expect(ours!.from < ours!.to).toBe(true)

    expect(await sync.finishRequest(running.id, "done", "ok")).toBe(true)
    expect(await sync.finishRequest(running.id, "failed", "late")).toBe(false)
    const { latest } = await sync.getSyncOverview()
    expect(latest?.status).toBe("done")
  })

  it("gives up on a request nobody took, and on one that stopped answering", async () => {
    const old = new Date(Date.now() - 20 * 60_000)
    const [waiting] = await db.insert(schema.syncRequests).values({ requestedAt: old }).returning()
    await sync.getSyncOverview() // closes what nobody works on any more
    const [closed] = await db
      .select()
      .from(schema.syncRequests)
      .where(eq(schema.syncRequests.id, waiting.id))
    expect(closed.status).toBe("failed")
    expect(closed.message).toContain("never started")

    const [stuck] = await db
      .insert(schema.syncRequests)
      .values({ status: "running", startedAt: old })
      .returning()
    await sync.getSyncOverview()
    const [lost] = await db
      .select()
      .from(schema.syncRequests)
      .where(eq(schema.syncRequests.id, stuck.id))
    expect(lost.status).toBe("failed")
    expect(lost.message).toContain("stopped answering")
  })

  it("keeps a long result message, one line per account", async () => {
    const request = await sync.requestSync()
    await sync.claimNextRequest()
    const message = Array.from({ length: 60 }, (_, i) => `✓ Account ${i}: 2 new fills`).join("\n")
    expect(message.length).toBeGreaterThan(500)
    expect(await sync.finishRequest(request.id, "done", message)).toBe(true)
    expect((await sync.getSyncOverview()).latest?.message).toBe(message)
  })

  it("cancels an open request and refuses the agent's late answers", async () => {
    const request = await sync.requestSync()
    expect(await sync.cancelOpenRequests()).toBe(1)
    expect(await sync.cancelOpenRequests()).toBe(0)
    expect(await sync.finishRequest(request.id, "done", "late")).toBe(false)
    const { latest } = await sync.getSyncOverview()
    expect(latest?.message).toBe("Cancelled.")
  })

  it("syncs one prop firm: its active accounts only, whatever the spelling", async () => {
    const stamp = Date.now()
    const make = (name: string, firm: string, status: "active" | "blown") =>
      db
        .insert(schema.accounts)
        .values({
          name,
          firm,
          status,
          tradovateName: `SYNCFIRM-${stamp}-${name}`,
          initialBalance: 50000,
        })
        .returning({ id: schema.accounts.id })
    const [a] = await make("A", "Firm One", "active")
    const [b] = await make("B", "firm one ", "active")
    const [dead] = await make("C", "Firm One", "blown")
    const [other] = await make("D", "Firm Two", "active")
    try {
      const request = await sync.requestSync({ firm: "FIRM ONE" })
      expect(request.firm).toBe("FIRM ONE")
      const ids = (await sync.syncTargets(request)).map((target) => target.id)
      expect(ids).toContain(a.id)
      expect(ids).toContain(b.id)
      expect(ids).not.toContain(dead.id)
      expect(ids).not.toContain(other.id)
      expect((await sync.getSyncHistory(1))[0].firm).toBe("FIRM ONE")
    } finally {
      await sync.cancelOpenRequests()
      for (const row of [a, b, dead, other]) {
        await db.delete(schema.accounts).where(eq(schema.accounts.id, row.id))
      }
    }
  })

  it("remembers which accounts the agent could not find, and forgets it when they come back", async () => {
    const [gone] = await db
      .insert(schema.accounts)
      .values({
        name: "Presence",
        firm: "TestFirm",
        tradovateName: `PRESENCE-${Date.now()}`,
        initialBalance: 50000,
      })
      .returning({ id: schema.accounts.id })
    const notFoundAt = async () =>
      (await db.select().from(schema.accounts).where(eq(schema.accounts.id, gone.id)))[0].notFoundAt
    try {
      expect(await notFoundAt()).toBeNull()
      const first = new Date("2026-11-03T10:00:00Z")
      await sync.recordPresence([], [gone.id], first)
      expect(await notFoundAt()).toEqual(first)
      // Missed again later: it keeps the first day.
      await sync.recordPresence([], [gone.id], new Date("2026-11-05T10:00:00Z"))
      expect(await notFoundAt()).toEqual(first)
      await sync.recordPresence([gone.id], [])
      expect(await notFoundAt()).toBeNull()
    } finally {
      await db.delete(schema.accounts).where(eq(schema.accounts.id, gone.id))
    }
  })

  it("serves the cloud run only with the right token", async () => {
    const next = await import("@/app/api/sync/next/route")
    const files = await import("@/app/api/sync/[id]/files/route")
    const finish = await import("@/app/api/sync/[id]/finish/route")
    const url = "http://localhost/api/sync/next"

    expect((await next.GET(new Request(url))).status).toBe(401)
    expect(
      (await next.GET(new Request(url, { headers: { authorization: `Bearer ${"x".repeat(48)}` } })))
        .status
    ).toBe(401)
    expect((await (await next.GET(new Request(url, { headers: auth }))).json()).request).toBeNull()

    // The logins saved in the app travel with the request, for its prop firms only.
    const logins = await import("@/db/tradovate-logins")
    await logins.saveLoginForAccount("TestFirm", { username: "u-test", password: "p-test" })
    await logins.saveLoginForAccount("OtherFirm", { username: "x", password: "y" })
    const request = await sync.requestSync({ accountId })
    let body
    try {
      body = await (await next.GET(new Request(url, { headers: auth }))).json()
    } finally {
      await logins.removeTradovateLogin("testfirm")
      await logins.removeTradovateLogin("otherfirm")
    }
    expect(body.request.logins).toEqual({ testfirm: { username: "u-test", password: "p-test" } })
    expect(body.request.accounts[0].loginKey).toBe("testfirm")
    expect(body.request.id).toBe(request.id)
    expect(body.request.accounts).toHaveLength(1)

    const params = Promise.resolve({ id: request.id })
    const post = (payload: unknown, headers: Record<string, string> = auth) =>
      new Request("http://localhost/x", {
        method: "POST",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify(payload),
      })
    expect((await files.POST(post({ fills: "x" }, {}), { params })).status).toBe(401)
    expect((await files.POST(post({}), { params })).status).toBe(400)
    expect(
      (await files.POST(post({ fills: "x" }), { params: Promise.resolve({ id: "nope" }) })).status
    ).toBe(400)
    expect((await files.POST(post({ fills: "not a csv" }), { params })).status).toBe(422)

    // A real export goes through, and sending it again adds nothing. Fill IDs are unique across the
    // whole database and another test imports the same fixture, so ours get their own IDs.
    const uniqueFillIds = String(Date.now()).slice(-8)
    const csv = readFileSync(
      new URL("../lib/trading/tradovate/__fixtures__/fills.csv", import.meta.url),
      "utf8"
    )
      .replaceAll("TESTACCOUNT0001", tradovateName)
      .replaceAll("69164431", uniqueFillIds)
    const first = await (await files.POST(post({ fills: csv }), { params })).json()
    expect(first.imported[0].newFills).toBeGreaterThan(0)
    const second = await (await files.POST(post({ fills: csv }), { params })).json()
    expect(second.imported[0].newFills).toBe(0)
    expect((await finish.POST(post({ status: "weird", message: "" }), { params })).status).toBe(400)
    expect(
      (
        await finish.POST(post({ status: "needs_login", message: "Lucid", missing: [accountId] }), {
          params,
        })
      ).status
    ).toBe(200)
    expect((await finish.POST(post({ status: "done", message: "again" }), { params })).status).toBe(
      409
    )
    expect((await sync.getSyncOverview()).latest?.status).toBe("needs_login")
    // What the cloud run reported about the account is kept on it.
    const [seen] = await db.select().from(schema.accounts).where(eq(schema.accounts.id, accountId))
    expect(seen.notFoundAt).not.toBeNull()
  })

  it("counts an account exported with nothing to import as imported", async () => {
    const finish = await import("@/app/api/sync/[id]/finish/route")
    await db
      .update(schema.accounts)
      .set({ lastImportedAt: new Date(0) })
      .where(eq(schema.accounts.id, accountId))
    const request = await sync.requestSync({ accountId })
    await sync.claimNextRequest()
    const response = await finish.POST(
      new Request("http://localhost/x", {
        method: "POST",
        headers: { ...auth, "content-type": "application/json" },
        body: JSON.stringify({
          status: "done",
          message: "ok",
          found: [accountId],
          empty: [accountId],
        }),
      }),
      { params: Promise.resolve({ id: request.id }) }
    )
    expect(response.status).toBe(200)
    const [account] = await db
      .select()
      .from(schema.accounts)
      .where(eq(schema.accounts.id, accountId))
    expect(account.lastImportedAt!.getTime()).toBeGreaterThan(Date.now() - 60_000)
  })
})
