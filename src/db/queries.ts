import { and, asc, desc, eq, gte, inArray, lt, max, sql } from "drizzle-orm"
import { accountsInScope, rangeBounds, type Filters } from "@/lib/filters"
import { parseMonth, shiftMonth } from "@/lib/month"
import { dayKey } from "@/lib/trading/stats"
import {
  UUID_PATTERN,
  describeTrade,
  type BreakEvenSource,
  type TradeStatus,
} from "@/lib/trading/trade"
import { db } from "."
import { accounts, cashFees, dayNotes, fills, trades, transactions } from "./schema"

export type Account = typeof accounts.$inferSelect
export type Trade = typeof trades.$inferSelect
export type Fill = typeof fills.$inferSelect

/** A trade with its win / loss / break-even status worked out. */
export type TradeRow = Trade & { status: TradeStatus; breakEvenSource: BreakEvenSource | null }

export function listAccounts(): Promise<Account[]> {
  return db.select().from(accounts).orderBy(asc(accounts.createdAt))
}

/** Trades matching the filters (by the trading day they closed on), oldest first, with the accounts they belong to. */
export async function getTrades(filters: Filters) {
  const allAccounts = await listAccounts()
  // One account, or a group of accounts. By default every account counts, blown and closed ones included:
  // a track record without the accounts that failed would flatter it.
  const selected = filters.accountId
    ? allAccounts.filter((account) => account.id === filters.accountId)
    : accountsInScope(allAccounts, filters.scope)

  const rows =
    selected.length === 0
      ? []
      : selected.length === allAccounts.length
        ? await db.select().from(trades)
        : await db
            .select()
            .from(trades)
            .where(
              inArray(
                trades.accountId,
                selected.map((account) => account.id)
              )
            )

  const { from, to } = rangeBounds(filters.range)
  const inRange: TradeRow[] = rows
    .map((trade) => ({ ...trade, ...describeTrade(trade) }))
    .filter((trade) => {
      const day = dayKey(trade.closedAt)
      return (!from || day >= from) && (!to || day <= to)
    })
    .sort((a, b) => a.closedAt.getTime() - b.closedAt.getTime())

  return { trades: inRange, accounts: selected, allAccounts }
}

/** One trade with its account and the fills it was built from, or null if the ID is unknown. */
export async function getTrade(id: string) {
  if (!UUID_PATTERN.test(id)) return null
  const [trade] = await db.select().from(trades).where(eq(trades.id, id))
  if (!trade) return null

  const [account] = await db.select().from(accounts).where(eq(accounts.id, trade.accountId))
  const tradeFills = await db
    .select()
    .from(fills)
    .where(inArray(fills.id, trade.fillIds))
    .orderBy(asc(fills.timestamp))
  return { trade, account, fills: tradeFills }
}

/** Journal notes of a month ("YYYY-MM"), keyed by day. */
export async function getDayNotes(month: string): Promise<Map<string, string>> {
  const parsed = parseMonth(month)
  if (!parsed) return new Map()
  const rows = await db
    .select()
    .from(dayNotes)
    .where(
      and(
        gte(dayNotes.day, `${month}-01`),
        lt(dayNotes.day, `${shiftMonth(parsed.year, parsed.month, 1)}-01`)
      )
    )
  return new Map(rows.map((row) => [row.day, row.note]))
}

/** Every transaction with the name of its account (null when it has none), newest first. */
export async function listTransactions() {
  return db
    .select({
      id: transactions.id,
      day: transactions.day,
      firm: transactions.firm,
      type: transactions.type,
      amount: transactions.amount,
      note: transactions.note,
      accountId: transactions.accountId,
      accountName: accounts.name,
    })
    .from(transactions)
    .leftJoin(accounts, eq(transactions.accountId, accounts.id))
    .orderBy(desc(transactions.day), desc(transactions.createdAt))
}

/** When each account last closed a trade (one small query, not every trade). */
export async function getLastTradeByAccount(): Promise<Map<string, Date>> {
  const rows = await db
    .select({ accountId: trades.accountId, last: max(trades.closedAt) })
    .from(trades)
    .groupBy(trades.accountId)
  return new Map(rows.flatMap((row) => (row.last ? [[row.accountId, row.last] as const] : [])))
}

/** Close time and net P&L of every trade, grouped by account ID. */
export async function getTradeResultsByAccount(): Promise<
  Map<string, { closedAt: Date; netPnl: number }[]>
> {
  const rows = await db
    .select({ accountId: trades.accountId, closedAt: trades.closedAt, netPnl: trades.netPnl })
    .from(trades)
  const byAccount = new Map<string, { closedAt: Date; netPnl: number }[]>()
  for (const { accountId, ...result } of rows) {
    byAccount.set(accountId, [...(byAccount.get(accountId) ?? []), result])
  }
  return byAccount
}

export interface AccountDataCounts {
  trades: number
  fills: number
  fees: number
  /** Investment transactions linked to the account; they survive its deletion. */
  transactions: number
}

/** What each account holds, to tell Walid what deleting it would erase. */
export async function getAccountDataCounts(): Promise<Map<string, AccountDataCounts>> {
  const count = sql<number>`count(*)::int`
  const [tradeRows, fillRows, feeRows, transactionRows] = await Promise.all([
    db.select({ id: trades.accountId, n: count }).from(trades).groupBy(trades.accountId),
    db.select({ id: fills.accountId, n: count }).from(fills).groupBy(fills.accountId),
    db.select({ id: cashFees.accountId, n: count }).from(cashFees).groupBy(cashFees.accountId),
    db
      .select({ id: transactions.accountId, n: count })
      .from(transactions)
      .groupBy(transactions.accountId),
  ])
  const counts = new Map<string, AccountDataCounts>()
  const entry = (id: string) => {
    const existing = counts.get(id) ?? { trades: 0, fills: 0, fees: 0, transactions: 0 }
    counts.set(id, existing)
    return existing
  }
  for (const row of tradeRows) entry(row.id).trades = row.n
  for (const row of fillRows) entry(row.id).fills = row.n
  for (const row of feeRows) entry(row.id).fees = row.n
  for (const row of transactionRows) if (row.id) entry(row.id).transactions = row.n
  return counts
}
