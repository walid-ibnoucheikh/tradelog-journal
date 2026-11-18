/**
 * Runs the real import against a Neon database. Needs TEST_DATABASE_URL (a dedicated Neon
 * branch, see README) and is skipped without it. It never touches DATABASE_URL.
 */
import { randomUUID } from "node:crypto"
import { readFileSync } from "node:fs"
import { and, eq, gte, like, lt } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

try {
  process.loadEnvFile(".env.test.local")
} catch {
  // No local env file: rely on the process environment (CI).
}

const testUrl = process.env.TEST_DATABASE_URL
const hostOf = (url: string) => new URL(url).hostname

const fixture = readFileSync(
  new URL("../lib/trading/tradovate/__fixtures__/fills.csv", import.meta.url),
  "utf8"
)
const tradovateName = `TEST-${randomUUID().slice(0, 8)}`
const csv = fixture.replaceAll("TESTACCOUNT0001", tradovateName)
const cashCsv = readFileSync(
  new URL("../lib/trading/tradovate/__fixtures__/cash-history.csv", import.meta.url),
  "utf8"
).replaceAll("TESTACCOUNT0001", tradovateName)

const round2 = (value: number) => Math.round(value * 100) / 100

describe.skipIf(!testUrl)("importTradovateFiles (Neon test branch)", { timeout: 60_000 }, () => {
  let db: typeof import("@/db").db
  let schema: typeof import("@/db/schema")
  let importFiles: typeof import("@/db/import-fills").importTradovateFiles
  let accountId: string

  beforeAll(async () => {
    if (process.env.DATABASE_URL && hostOf(process.env.DATABASE_URL) === hostOf(testUrl!)) {
      throw new Error("TEST_DATABASE_URL points at the same database as DATABASE_URL")
    }
    process.env.DATABASE_URL = testUrl

    ;({ db } = await import("@/db"))
    schema = await import("@/db/schema")
    ;({ importTradovateFiles: importFiles } = await import("@/db/import-fills"))

    const { migrate } = await import("drizzle-orm/neon-http/migrator")
    await migrate(db, { migrationsFolder: "./drizzle" })

    // Leftovers of a crashed earlier run would hold the same Tradovate fill IDs.
    await db.delete(schema.accounts).where(like(schema.accounts.tradovateName, "TEST-%"))
  })

  afterAll(async () => {
    if (db) await db.delete(schema.accounts).where(eq(schema.accounts.tradovateName, tradovateName))
  })

  it("reports an account that does not exist yet instead of importing it", async () => {
    const summary = await importFiles({ fills: csv })
    expect(summary.imported).toEqual([])
    expect(summary.unknownAccounts).toEqual([tradovateName])
  })

  it("imports fills and rebuilds trades that match the Tradovate reports", async () => {
    const [account] = await db
      .insert(schema.accounts)
      .values({ name: "Test", firm: "Apex", tradovateName, initialBalance: 50000 })
      .returning()
    accountId = account.id

    const beforeImport = Date.now()
    const summary = await importFiles({ fills: csv })
    expect(summary.unknownAccounts).toEqual([])
    expect(summary.imported).toEqual([
      {
        account: "Test",
        fillsInFile: 32,
        newFills: 32,
        feesInFile: 0,
        newFees: 0,
        fillsWithFees: 0,
        fillsTotal: 32,
        trades: 16,
        openContracts: 0,
      },
    ])

    const trades = await db
      .select()
      .from(schema.trades)
      .where(eq(schema.trades.accountId, accountId))
    const [imported] = await db
      .select({ lastImportedAt: schema.accounts.lastImportedAt })
      .from(schema.accounts)
      .where(eq(schema.accounts.id, accountId))
    expect(imported.lastImportedAt!.getTime()).toBeGreaterThanOrEqual(beforeImport - 1000)
    const net = trades.reduce((sum, trade) => sum + trade.netPnl, 0)
    expect(Math.round(net * 100) / 100).toBe(676.4)
  })

  it("prices the trades with the real fees of Cash History", async () => {
    const netOf = async () =>
      round2(
        (
          await db.select().from(schema.trades).where(eq(schema.trades.accountId, accountId))
        ).reduce((sum, trade) => sum + trade.netPnl, 0)
      )
    const [{ lastImportedAt: before }] = await db
      .select({ lastImportedAt: schema.accounts.lastImportedAt })
      .from(schema.accounts)
      .where(eq(schema.accounts.id, accountId))

    const summary = await importFiles({ cash: cashCsv })
    expect(summary.imported[0]).toMatchObject({
      fillsInFile: 0,
      feesInFile: 128,
      newFees: 128,
      fillsWithFees: 32,
      fillsTotal: 32,
      trades: 16,
    })
    // 130 contracts traded, 0.56 $ of exchange, clearing and NFA fees per contract and side.
    expect(await netOf()).toBe(603.6)

    // Fees alone do not make the trades any fresher.
    const [{ lastImportedAt: after }] = await db
      .select({ lastImportedAt: schema.accounts.lastImportedAt })
      .from(schema.accounts)
      .where(eq(schema.accounts.id, accountId))
    expect(after).toEqual(before)

    // The same file again changes nothing.
    expect((await importFiles({ cash: cashCsv })).imported[0]).toMatchObject({ newFees: 0 })
    expect(await netOf()).toBe(603.6)
  })

  it("finds the fees of fills stored before their local time was kept", async () => {
    await db
      .update(schema.fills)
      .set({ localTime: null })
      .where(eq(schema.fills.accountId, accountId))
    expect((await importFiles({})).imported).toEqual([])

    const summary = await importFiles({ fills: csv })
    expect(summary.imported[0]).toMatchObject({ newFills: 0, fillsWithFees: 32, fillsTotal: 32 })
  })

  it("is idempotent and keeps notes and break-even choices when trades are rebuilt", async () => {
    const [first] = await db
      .select()
      .from(schema.trades)
      .where(eq(schema.trades.accountId, accountId))
      .orderBy(schema.trades.openedAt)
      .limit(1)
    await db
      .update(schema.trades)
      .set({ note: "ma note", breakEvenOverride: false })
      .where(eq(schema.trades.id, first.id))

    const summary = await importFiles({ fills: csv })
    expect(summary.imported[0]).toMatchObject({ newFills: 0, trades: 16 })

    const fills = await db.select().from(schema.fills).where(eq(schema.fills.accountId, accountId))
    const trades = await db
      .select()
      .from(schema.trades)
      .where(eq(schema.trades.accountId, accountId))
    expect(fills).toHaveLength(32)
    expect(trades).toHaveLength(16)
    expect(trades.filter((trade) => trade.note === "ma note")).toHaveLength(1)
    expect(trades.filter((trade) => trade.breakEvenOverride === false)).toHaveLength(1)
    expect(trades.find((trade) => trade.id === first.id)?.note).toBe("ma note")
  })

  it("deletes fills and trades with their account", async () => {
    await db.delete(schema.accounts).where(eq(schema.accounts.id, accountId))
    expect(
      await db.select().from(schema.fills).where(eq(schema.fills.accountId, accountId))
    ).toEqual([])
    expect(
      await db.select().from(schema.trades).where(eq(schema.trades.accountId, accountId))
    ).toEqual([])
  })

  it("stores journal notes per day and reads them back by month", async () => {
    // Far in the past so it cannot collide with anything real in this branch.
    const testDays = and(
      gte(schema.dayNotes.day, "1998-12-01"),
      lt(schema.dayNotes.day, "1999-03-01")
    )
    await db.delete(schema.dayNotes).where(testDays)
    await db.insert(schema.dayNotes).values([
      { day: "1999-01-31", note: "fin de mois" },
      { day: "1999-02-01", note: "début du mois suivant" },
      { day: "1998-12-31", note: "mois précédent" },
    ])
    const { getDayNotes } = await import("@/db/queries")
    expect([...(await getDayNotes("1999-01")).entries()]).toEqual([["1999-01-31", "fin de mois"]])
    expect(await getDayNotes("garbage")).toEqual(new Map())
    await db.delete(schema.dayNotes).where(testDays)
  })

  it("keeps transactions when their account is deleted", async () => {
    const [account] = await db
      .insert(schema.accounts)
      .values({
        name: "Tx",
        firm: "Apex",
        tradovateName: `TEST-tx-${randomUUID().slice(0, 8)}`,
        initialBalance: 50000,
      })
      .returning()
    const [transaction] = await db
      .insert(schema.transactions)
      .values({
        day: "1999-01-05",
        firm: "Apex",
        accountId: account.id,
        type: "evaluation",
        amount: 37.5,
      })
      .returning()
    const { listTransactions } = await import("@/db/queries")

    const before = (await listTransactions()).find((row) => row.id === transaction.id)
    expect(before).toMatchObject({ accountName: "Tx", amount: 37.5, type: "evaluation" })

    await db.delete(schema.accounts).where(eq(schema.accounts.id, account.id))
    const after = (await listTransactions()).find((row) => row.id === transaction.id)
    expect(after).toMatchObject({ accountId: null, accountName: null, firm: "Apex" })

    await db.delete(schema.transactions).where(eq(schema.transactions.id, transaction.id))
  })
  it("counts what an account holds, and deleting it erases its fills, fees and trades", async () => {
    const name = `TEST-del-${randomUUID().slice(0, 8)}`
    const [account] = await db
      .insert(schema.accounts)
      .values({ name: "À supprimer", firm: "Apex", tradovateName: name, initialBalance: 50000 })
      .returning()
    // Same fixtures under another account name: Fill and Transaction IDs are global keys, so
    // they get a prefix to stay distinct from the other tests' rows.
    const ownFills = fixture
      .replaceAll("TESTACCOUNT0001", name)
      .replace(/^(\d{9,})/gm, (id) => `9${id}`)
    const ownCash = cashCsv.replace(/^[^,]+,(\d+)/gm, (_line, id) => `${name},9${id}`)
    await importFiles({ fills: ownFills, cash: ownCash })

    const { getAccountDataCounts } = await import("@/db/queries")
    const counts = (await getAccountDataCounts()).get(account.id)
    expect(counts).toMatchObject({ fills: 32, fees: 128, transactions: 0 })
    expect(counts?.trades).toBeGreaterThan(0)

    await db.delete(schema.accounts).where(eq(schema.accounts.id, account.id))
    expect((await getAccountDataCounts()).get(account.id)).toBeUndefined()
    const left = await db
      .select({ id: schema.fills.id })
      .from(schema.fills)
      .where(eq(schema.fills.accountId, account.id))
    expect(left).toEqual([])
  })

  it("stores spending outside prop firms: no account, the provider in place of the firm", async () => {
    const [transaction] = await db
      .insert(schema.transactions)
      .values({ day: "1999-02-01", firm: "TradingView", type: "tools", amount: 14.95 })
      .returning()
    const { listTransactions } = await import("@/db/queries")
    const row = (await listTransactions()).find((item) => item.id === transaction.id)
    expect(row).toMatchObject({
      type: "tools",
      firm: "TradingView",
      accountId: null,
      amount: 14.95,
    })
    await db.delete(schema.transactions).where(eq(schema.transactions.id, transaction.id))
  })
})
