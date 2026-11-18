"use server"

import { randomUUID } from "node:crypto"
import { requireAuth } from "@/lib/auth/auth"
import { and, eq, ne } from "drizzle-orm"
import { afterWrite } from "@/db/cache"
import { db } from "@/db"
import { accounts, transactions } from "@/db/schema"
import { parseDrawdownType, type DrawdownType } from "@/lib/accounts/account-rules"
import { isRealDay } from "@/lib/day"
import { formValues } from "@/lib/form"
import { parseAccountStatus } from "@/lib/investments/investments"
import { readPurchase } from "@/lib/investments/purchase"
import { UUID_PATTERN } from "@/lib/trading/trade"
import { loginStorageReady, saveLoginForAccount } from "@/db/tradovate-logins"
import { LOGIN_STORAGE_OFF, readLogin } from "@/lib/credentials/login-input"

export interface AccountFormState {
  error?: string
  success?: string
  /** The submitted fields, handed back on an error so the form keeps what was typed. */
  values?: Record<string, string>
}

interface AccountRulesInput {
  profitTarget: number | null
  maxDrawdown: number | null
  drawdownLockLevel: number | null
  dailyLossLimit: number | null
  consistencyPercent: number | null
  drawdownType: DrawdownType
}

/** The password is never handed back to the form: it would travel to the browser again. */
const fail = (error: string, formData: FormData) => {
  const values = formValues(formData)
  delete values.tradovatePassword
  return { error, values }
}

function text(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === "string" ? value.trim() : ""
}

function optionalAmount(formData: FormData, key: string) {
  const value = text(formData, key)
  return value === "" ? null : Number(value)
}

/** The optional rules of an account, or an error message when one of them is not valid. */
function readRules(formData: FormData): { error: string } | { rules: AccountRulesInput } {
  const profitTarget = optionalAmount(formData, "profitTarget")
  const maxDrawdown = optionalAmount(formData, "maxDrawdown")
  const drawdownLockLevel = optionalAmount(formData, "drawdownLockLevel")
  const dailyLossLimit = optionalAmount(formData, "dailyLossLimit")
  const consistencyPercent = optionalAmount(formData, "consistencyPercent")
  const drawdownType = parseDrawdownType(text(formData, "drawdownType"))

  const amounts = [profitTarget, maxDrawdown, drawdownLockLevel, dailyLossLimit]
  if (amounts.some((amount) => amount !== null && !(amount > 0))) {
    return {
      error:
        "The profit target, max drawdown, locked threshold and daily loss must be positive numbers.",
    }
  }
  if (consistencyPercent !== null && !(consistencyPercent > 0 && consistencyPercent <= 100)) {
    return { error: "The consistency rule must be a percentage between 0 and 100." }
  }
  if (!drawdownType) return { error: "Invalid drawdown type." }
  return {
    rules: {
      profitTarget,
      maxDrawdown,
      drawdownLockLevel,
      dailyLossLimit,
      consistencyPercent,
      drawdownType,
    },
  }
}

interface AccountIdentity {
  name: string
  firm: string
  tradovateName: string
  type: "eval" | "funded"
  initialBalance: number
}

/** The name, firm, Tradovate name, type and starting balance of an account, or an error message. */
function readIdentity(formData: FormData): { error: string } | { identity: AccountIdentity } {
  const name = text(formData, "name")
  const firm = text(formData, "firm")
  const tradovateName = text(formData, "tradovateName")
  const type = text(formData, "type") === "funded" ? "funded" : "eval"
  const initialBalance = Number(text(formData, "initialBalance"))
  if (!name || !firm || !tradovateName) {
    return { error: "The name, prop firm and Tradovate account name are required." }
  }
  if (!(initialBalance > 0)) return { error: "The initial balance must be a positive number." }
  return { identity: { name, firm, tradovateName, type, initialBalance } }
}

/** The optional Tradovate username and password of the account form, checked (nothing is written). */
function readTypedLogin(formData: FormData) {
  const password = formData.get("tradovatePassword")
  const login = readLogin(
    text(formData, "tradovateUsername"),
    typeof password === "string" ? password : ""
  )
  if ("login" in login && !loginStorageReady()) return { error: LOGIN_STORAGE_OFF }
  return login
}

export async function createAccount(
  _previous: AccountFormState,
  formData: FormData
): Promise<AccountFormState> {
  await requireAuth()
  const identity = readIdentity(formData)
  const parsed = readRules(formData)
  if ("error" in identity) return fail(identity.error, formData)
  if ("error" in parsed) return fail(parsed.error, formData)

  const existing = await db
    .select({ name: accounts.name })
    .from(accounts)
    .where(eq(accounts.tradovateName, identity.identity.tradovateName))
  if (existing.length > 0) {
    return fail(`This Tradovate account already exists (“${existing[0].name}”).`, formData)
  }

  const purchase = readPurchase({
    amount: text(formData, "purchaseAmount"),
    day: text(formData, "purchaseDay"),
    type: text(formData, "purchaseType"),
  })
  if ("error" in purchase) return fail(purchase.error, formData)

  // Optional: the Tradovate login of this account, for the cloud sync. Checked before anything is written.
  const login = readTypedLogin(formData)
  if ("error" in login) return fail(login.error, formData)

  // The login first, so the account can point to it (null = the login of its prop firm).
  const loginKey =
    "login" in login ? await saveLoginForAccount(identity.identity.firm, login.login) : null

  const id = randomUUID()
  const account = db
    .insert(accounts)
    .values({ id, ...identity.identity, ...parsed.rules, loginKey })
  if (purchase.purchase) {
    // One batch: the account and what it cost exist together or not at all.
    await db.batch([
      account,
      db.insert(transactions).values({
        day: purchase.purchase.day,
        type: purchase.purchase.type,
        amount: purchase.purchase.amount,
        accountId: id,
        firm: identity.identity.firm,
      }),
    ])
  } else {
    await account
  }
  afterWrite()
  return {
    success: `Account “${identity.identity.name}” created${purchase.purchase ? " with its purchase" : ""}.`,
  }
}

export async function updateAccount(
  accountId: string,
  _previous: AccountFormState,
  formData: FormData
): Promise<AccountFormState> {
  await requireAuth()
  const identity = readIdentity(formData)
  if ("error" in identity) return fail(identity.error, formData)
  if (!UUID_PATTERN.test(accountId)) return fail("Account not found.", formData)
  const login = readTypedLogin(formData)
  if ("error" in login) return fail(login.error, formData)

  const clash = await db
    .select({ name: accounts.name })
    .from(accounts)
    .where(
      and(eq(accounts.tradovateName, identity.identity.tradovateName), ne(accounts.id, accountId))
    )
  if (clash.length > 0) {
    return fail(`This Tradovate account is already used by “${clash[0].name}”.`, formData)
  }

  // A typed login moves the account onto it; without one the account keeps the login it has.
  const loginKey =
    "login" in login ? await saveLoginForAccount(identity.identity.firm, login.login) : undefined
  const updated = await db
    .update(accounts)
    .set({ ...identity.identity, ...(loginKey !== undefined ? { loginKey } : {}) })
    .where(eq(accounts.id, accountId))
    .returning({ id: accounts.id })
  if (updated.length === 0) return fail("Account not found.", formData)

  afterWrite()
  return { success: "Account updated." }
}

/**
 * Deletes an account with its fills, fees and trades (cascade). Investment transactions are kept
 * without a linked account. The account's name must be typed back, so a stray click cannot do it.
 */
export async function deleteAccount(
  accountId: string,
  _previous: AccountFormState,
  formData: FormData
): Promise<AccountFormState> {
  await requireAuth()
  if (!UUID_PATTERN.test(accountId)) return fail("Account not found.", formData)

  const [account] = await db
    .select({ name: accounts.name })
    .from(accounts)
    .where(eq(accounts.id, accountId))
  if (!account) return fail("Account not found.", formData)
  if (text(formData, "confirmName") !== account.name) {
    return fail("The name you typed does not match the account: nothing was deleted.", formData)
  }

  await db.delete(accounts).where(eq(accounts.id, accountId))
  afterWrite()
  return { success: `Account “${account.name}” deleted.` }
}

export async function updateLifecycle(
  accountId: string,
  _previous: AccountFormState,
  formData: FormData
): Promise<AccountFormState> {
  await requireAuth()
  const status = parseAccountStatus(text(formData, "status"))
  const fundedAt = text(formData, "fundedAt")
  const endedAt = text(formData, "endedAt")

  if (!UUID_PATTERN.test(accountId) || !status) return fail("Invalid status.", formData)
  if (fundedAt && !isRealDay(fundedAt)) return fail("Invalid funded date.", formData)
  if (status !== "active" && !isRealDay(endedAt)) {
    return fail("Enter the date the account was blown or closed.", formData)
  }

  const updated = await db
    .update(accounts)
    .set({
      status,
      fundedAt: fundedAt || null,
      endedAt: status === "active" ? null : endedAt,
      // Passing the evaluation is what makes an account funded.
      ...(fundedAt ? { type: "funded" as const } : {}),
    })
    .where(eq(accounts.id, accountId))
    .returning({ id: accounts.id })
  if (updated.length === 0) return fail("Account not found.", formData)

  afterWrite()
  return { success: "Status updated." }
}

export async function updateRules(
  accountId: string,
  _previous: AccountFormState,
  formData: FormData
): Promise<AccountFormState> {
  await requireAuth()
  const parsed = readRules(formData)
  if ("error" in parsed) return fail(parsed.error, formData)
  if (!UUID_PATTERN.test(accountId)) return fail("Account not found.", formData)

  const updated = await db
    .update(accounts)
    .set(parsed.rules)
    .where(eq(accounts.id, accountId))
    .returning({ id: accounts.id })
  if (updated.length === 0) return fail("Account not found.", formData)

  afterWrite()
  return { success: "Rules updated." }
}

/**
 * "Mark as blown / closed" on a suggestion: one click, with the day the account really ended (the
 * trade that breached the threshold, or the last trade), not the day of the click. Only an active
 * account is changed.
 */
export async function markAccountEnded(formData: FormData) {
  await requireAuth()
  const accountId = text(formData, "accountId")
  const status = text(formData, "status")
  const day = text(formData, "day")
  if (!UUID_PATTERN.test(accountId) || (status !== "blown" && status !== "closed")) return
  if (!isRealDay(day)) return

  await db
    .update(accounts)
    .set({ status, endedAt: day })
    .where(and(eq(accounts.id, accountId), eq(accounts.status, "active")))
  afterWrite()
}
