/**
 * Runs the saved Tradovate logins against a Neon database. Needs TEST_DATABASE_URL (a dedicated Neon
 * branch) and is skipped without it. It never touches DATABASE_URL.
 */
import { randomBytes } from "node:crypto"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

try {
  process.loadEnvFile(".env.test.local")
} catch {
  // No local env file: rely on the process environment (CI).
}

const testUrl = process.env.TEST_DATABASE_URL
const hostOf = (url: string) => new URL(url).hostname
const FIRM = `LoginTest${Date.now()}`
const DEFAULT_KEY = FIRM.toLowerCase()

describe.skipIf(!testUrl)("saved Tradovate logins (Neon test branch)", { timeout: 60_000 }, () => {
  let extraKey = ""
  let logins: typeof import("@/db/tradovate-logins")
  let db: typeof import("@/db").db
  let schema: typeof import("@/db/schema")
  let orm: typeof import("drizzle-orm")

  beforeAll(async () => {
    if (process.env.DATABASE_URL && hostOf(process.env.DATABASE_URL) === hostOf(testUrl!)) {
      throw new Error("TEST_DATABASE_URL points at the same database as DATABASE_URL")
    }
    process.env.DATABASE_URL = testUrl
    process.env.CREDENTIALS_KEY = randomBytes(32).toString("base64")
    ;({ db } = await import("@/db"))
    schema = await import("@/db/schema")
    orm = await import("drizzle-orm")
    logins = await import("@/db/tradovate-logins")
  })

  afterAll(async () => {
    await logins.removeTradovateLogin(DEFAULT_KEY)
    if (extraKey) await logins.removeTradovateLogin(extraKey)
  })

  it("makes the first login typed for a firm its default login, encrypted", async () => {
    expect(
      await logins.saveLoginForAccount(FIRM, { username: "walid.test", password: "s3cret-pass" })
    ).toBeNull()
    const [row] = await db
      .select()
      .from(schema.tradovateLogins)
      .where(orm.eq(schema.tradovateLogins.firmKey, DEFAULT_KEY))
    expect(row.secret).not.toContain("walid.test")
    expect(row.secret).not.toContain("s3cret-pass")
    expect(row.label).toBeNull()
    expect(await logins.loginsForKeys([DEFAULT_KEY, "nosuchfirm"])).toEqual({
      [DEFAULT_KEY]: { username: "walid.test", password: "s3cret-pass" },
    })
  })

  it("updates the same login when the same username is typed again", async () => {
    expect(
      await logins.saveLoginForAccount(FIRM.toUpperCase(), {
        username: " Walid.Test ",
        password: "new-pass",
      })
    ).toBeNull()
    expect((await logins.loginsForKeys([DEFAULT_KEY]))[DEFAULT_KEY].password).toBe("new-pass")
    expect((await logins.listSavedLogins()).filter((row) => row.firm === FIRM)).toHaveLength(1)
  })

  it("keeps a different username as a second login of the firm, beside the first", async () => {
    const key = await logins.saveLoginForAccount(FIRM, {
      username: "walid.two",
      password: "pass-two",
    })
    expect(key).toMatch(new RegExp(`^${DEFAULT_KEY}:[0-9a-f]{8}$`))
    extraKey = key!
    const found = await logins.loginsForKeys([DEFAULT_KEY, extraKey])
    expect(found[DEFAULT_KEY].username.trim().toLowerCase()).toBe("walid.test")
    expect(found[extraKey]).toEqual({ username: "walid.two", password: "pass-two" })
    const listed = (await logins.listSavedLogins()).filter((row) => row.firm === FIRM)
    expect(listed.map((row) => row.label ?? "default").sort()).toEqual(["default", "login 2"])
    expect(JSON.stringify(listed)).not.toContain("pass-two")

    // The second username typed again finds the second login, not a third one.
    expect(
      await logins.saveLoginForAccount(FIRM, { username: "WALID.TWO", password: "pass-three" })
    ).toBe(extraKey)
    expect((await logins.loginsForKeys([extraKey]))[extraKey].password).toBe("pass-three")
  })

  it("replaces a listed login by its key, and refuses a key of another firm", async () => {
    await logins.saveLoginUnderKey(extraKey, FIRM, "login 2", { username: "u", password: "p" })
    expect((await logins.loginsForKeys([extraKey]))[extraKey]).toEqual({
      username: "u",
      password: "p",
    })
    await expect(
      logins.saveLoginUnderKey("someoneelse", FIRM, null, { username: "u", password: "p" })
    ).rejects.toThrow(/Unknown login/)
  })

  it("leaves out a login that does not open with the current key", async () => {
    process.env.CREDENTIALS_KEY = randomBytes(32).toString("base64")
    expect(await logins.loginsForKeys([DEFAULT_KEY, extraKey])).toEqual({})
  })

  it("forgets a login", async () => {
    if (extraKey) await logins.removeTradovateLogin(extraKey)
    expect((await logins.listSavedLogins()).map((row) => row.key)).not.toContain(extraKey)
  })
})
