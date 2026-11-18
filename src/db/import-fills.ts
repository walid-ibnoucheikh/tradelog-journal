import { asc, eq, inArray, sql } from "drizzle-orm"
import { parseCashFeesCsv, type CashFee } from "@/lib/trading/tradovate/cash"
import { applyCashFees } from "@/lib/trading/tradovate/fees"
import { parseFillsCsv, type Fill } from "@/lib/trading/tradovate/fills"
import { buildTrades } from "@/lib/trading/tradovate/trades"
import { db } from "."
import { accounts, cashFees, fills, trades } from "./schema"

export interface AccountImportResult {
  account: string
  fillsInFile: number
  newFills: number
  feesInFile: number
  newFees: number
  /** Fills priced with Tradovate's real fees from Cash History, out of `fillsTotal`. */
  fillsWithFees: number
  fillsTotal: number
  trades: number
  openContracts: number
}

export interface ImportSummary {
  imported: AccountImportResult[]
  /** Tradovate account names in the file that have no matching account yet. */
  unknownAccounts: string[]
}

const CHUNK_SIZE = 500

function chunks<T>(items: T[], size = CHUNK_SIZE): T[][] {
  const result: T[][] = []
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size))
  return result
}

/**
 * Store the fills of a Tradovate `Fills.csv` and the fees of a `Cash History.csv` (either may be
 * missing), then rebuild the trades of every affected account. Safe to run twice on the same
 * files: fills are keyed on Tradovate's fill ID and fees on its transaction ID.
 */
export async function importTradovateFiles(files: {
  fills?: string
  cash?: string
}): Promise<ImportSummary> {
  const parsedFills = files.fills ? parseFillsCsv(files.fills) : []
  const parsedFees = files.cash ? parseCashFeesCsv(files.cash) : []
  const fillsByAccount = groupByAccount(parsedFills)
  const feesByAccount = groupByAccount(parsedFees)

  const names = [...new Set([...fillsByAccount.keys(), ...feesByAccount.keys()])]
  const known =
    names.length === 0
      ? []
      : await db.select().from(accounts).where(inArray(accounts.tradovateName, names))
  const knownNames = new Set(known.map((account) => account.tradovateName))

  const imported: AccountImportResult[] = []
  for (const account of known) {
    const accountFills = fillsByAccount.get(account.tradovateName) ?? []
    const accountFees = feesByAccount.get(account.tradovateName) ?? []
    const newFills = await storeFills(account.id, accountFills)
    const newFees = await storeFees(account.id, accountFees)
    const rebuilt = await rebuildTrades(account.id, account.tradovateName)
    // Fees alone say nothing about whether the trades are up to date.
    if (files.fills) {
      await db
        .update(accounts)
        .set({ lastImportedAt: new Date() })
        .where(eq(accounts.id, account.id))
    }
    imported.push({
      account: account.name,
      fillsInFile: accountFills.length,
      newFills,
      feesInFile: accountFees.length,
      newFees,
      fillsWithFees: rebuilt.fillsWithFees,
      fillsTotal: rebuilt.fillsTotal,
      trades: rebuilt.trades,
      openContracts: rebuilt.openContracts,
    })
  }

  return { imported, unknownAccounts: names.filter((name) => !knownNames.has(name)) }
}

function groupByAccount<T extends { account: string }>(items: T[]) {
  const byAccount = new Map<string, T[]>()
  for (const item of items) {
    byAccount.set(item.account, [...(byAccount.get(item.account) ?? []), item])
  }
  return byAccount
}

/** Insert the fills of an account; returns how many were new. */
async function storeFills(accountId: string, accountFills: Fill[]) {
  let newFills = 0
  for (const chunk of chunks(accountFills)) {
    const existing = await db
      .select({ id: fills.id })
      .from(fills)
      .where(
        inArray(
          fills.id,
          chunk.map((fill) => fill.id)
        )
      )
    newFills += chunk.length - existing.length
    await db
      .insert(fills)
      .values(
        chunk.map((fill) => ({
          id: fill.id,
          accountId,
          orderId: fill.orderId,
          contract: fill.contract,
          product: fill.product,
          side: fill.side,
          quantity: fill.quantity,
          price: fill.price,
          commission: fill.commission,
          timestamp: fill.timestamp,
          localTime: fill.localTime,
          tradeDate: fill.tradeDate,
        }))
      )
      // A fill stored before fees existed has no local time: fill it in so its fees can match.
      .onConflictDoUpdate({
        target: fills.id,
        set: { localTime: sql`coalesce(${fills.localTime}, excluded.local_time)` },
      })
  }
  return newFills
}

/** Insert the fees of an account; returns how many were new. */
async function storeFees(accountId: string, accountFees: CashFee[]) {
  let newFees = 0
  for (const chunk of chunks(accountFees)) {
    const inserted = await db
      .insert(cashFees)
      .values(chunk.map((fee) => ({ ...fee, accountId })))
      .onConflictDoNothing()
      .returning({ id: cashFees.id })
    newFees += inserted.length
  }
  return newFees
}

/**
 * Recompute an account's trades from all its stored fills, priced with its stored Cash History
 * fees. A trade is matched to its previous version by its first fill, which keeps its ID, journal
 * note and break-even choice.
 */
async function rebuildTrades(accountId: string, tradovateName: string) {
  const rows = await db
    .select()
    .from(fills)
    .where(eq(fills.accountId, accountId))
    .orderBy(asc(fills.timestamp))
  const feeRows = await db.select().from(cashFees).where(eq(cashFees.accountId, accountId))
  const priced = applyCashFees(
    rows.map((row) => ({ ...row, account: tradovateName, localTime: row.localTime ?? "" })),
    feeRows.map((row) => ({ ...row, account: tradovateName }))
  )
  const { trades: built, openPositions } = buildTrades(priced.fills)

  const kept = new Map(
    (
      await db
        .select({
          id: trades.id,
          fillIds: trades.fillIds,
          note: trades.note,
          breakEvenOverride: trades.breakEvenOverride,
        })
        .from(trades)
        .where(eq(trades.accountId, accountId))
    ).map((row) => [row.fillIds[0], row])
  )

  const values = built.map((trade) => ({
    // Same first fill = same trade: keep its ID so links to it survive a re-import.
    id: kept.get(trade.fillIds[0])?.id,
    accountId,
    contract: trade.contract,
    product: trade.product,
    direction: trade.direction,
    openedAt: trade.openedAt,
    closedAt: trade.closedAt,
    quantity: trade.quantity,
    avgEntry: trade.avgEntry,
    avgExit: trade.avgExit,
    grossPnl: trade.grossPnl,
    commission: trade.commission,
    netPnl: trade.netPnl,
    fillIds: trade.fillIds,
    note: kept.get(trade.fillIds[0])?.note ?? null,
    breakEvenOverride: kept.get(trade.fillIds[0])?.breakEvenOverride ?? null,
  }))
  await db.batch([
    db.delete(trades).where(eq(trades.accountId, accountId)),
    ...chunks(values).map((chunk) => db.insert(trades).values(chunk)),
  ])

  return {
    fillsWithFees: priced.matched,
    fillsTotal: rows.length,
    trades: built.length,
    openContracts: openPositions.reduce((sum, position) => sum + position.quantity, 0),
  }
}
