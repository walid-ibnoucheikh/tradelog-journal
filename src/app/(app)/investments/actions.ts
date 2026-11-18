"use server"

import { requireAuth } from "@/lib/auth/auth"
import { eq } from "drizzle-orm"
import { afterWrite } from "@/db/cache"
import { db } from "@/db"
import { accounts, transactions } from "@/db/schema"
import { isRealDay } from "@/lib/day"
import { formValues } from "@/lib/form"
import {
  DEFAULT_PROVIDER,
  isOutsidePropFirm,
  parseTransactionType,
} from "@/lib/investments/investments"
import { UUID_PATTERN } from "@/lib/trading/trade"

export interface TransactionFormState {
  error?: string
  success?: string
  values?: Record<string, string>
}

const fail = (error: string, formData: FormData) => ({ error, values: formValues(formData) })

function text(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === "string" ? value.trim() : ""
}

export async function createTransaction(
  _previous: TransactionFormState,
  formData: FormData
): Promise<TransactionFormState> {
  await requireAuth()
  const day = text(formData, "day")
  const type = parseTransactionType(text(formData, "type"))
  const amount = Number(text(formData, "amount"))
  let accountId = text(formData, "accountId")
  const note = text(formData, "note")
  let firm = text(formData, "firm")

  if (!isRealDay(day)) return fail("Invalid date.", formData)
  if (!type) return fail("Choose a transaction type.", formData)
  if (!(amount > 0) || amount > 1_000_000) {
    return fail("The amount must be a positive number (in USD).", formData)
  }
  if (note.length > 500) return fail("The note is limited to 500 characters.", formData)

  if (isOutsidePropFirm(type)) {
    // Courses and tools belong to no account: the provider takes the place of the firm.
    accountId = ""
    firm = firm || DEFAULT_PROVIDER[type as keyof typeof DEFAULT_PROVIDER]
  } else if (accountId) {
    if (!UUID_PATTERN.test(accountId)) return fail("Account not found.", formData)
    const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId))
    if (!account) return fail("Account not found.", formData)
    firm = account.firm
  }
  if (!firm || firm.length > 60) {
    return fail(
      isOutsidePropFirm(type)
        ? "The provider is limited to 60 characters."
        : "Enter the prop firm (or choose an account).",
      formData
    )
  }

  await db.insert(transactions).values({
    day,
    type,
    amount: Math.round(amount * 100) / 100,
    accountId: accountId || null,
    firm,
    note: note || null,
  })
  afterWrite()
  return { success: "Transaction added." }
}

export async function deleteTransaction(id: string) {
  await requireAuth()
  if (!UUID_PATTERN.test(id)) return
  await db.delete(transactions).where(eq(transactions.id, id))
  afterWrite()
}
