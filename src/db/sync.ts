import { and, desc, eq, inArray, lt, max, or, sql } from "drizzle-orm"
import { accountLoginKey } from "@/lib/sync/firm-key"
import { CANCELLED_MESSAGE } from "@/lib/sync/sync-input"
import { syncWindow, type SyncWindow } from "@/lib/sync/sync-window"
import { db } from "."
import { accounts, fills, syncRequests } from "./schema"

/** A running request older than this is given up on: the cloud run crashed (the workflow stops at 15 min). */
const RUNNING_TIMEOUT_MS = 15 * 60_000
/** A pending request older than this was never picked up: the workflow did not start or failed early. */
const PENDING_TIMEOUT_MS = 10 * 60_000
/** The app keeps this much of a result message (a summary line, then one line per account). */
export const MESSAGE_MAX_LENGTH = 4000

export type SyncRequest = typeof syncRequests.$inferSelect

export interface SyncTarget extends SyncWindow {
  id: string
  name: string
  firm: string
  /** The account name in Tradovate, to pick it in the account selector. */
  tradovateName: string
  /** The saved Tradovate login this account uses (its own, else its prop firm's). */
  loginKey: string
}

/** Close the requests nobody is working on any more, so the button is never stuck (one query). */
async function expireStale(now = new Date()) {
  await db
    .update(syncRequests)
    .set({
      status: "failed",
      message: sql`case when ${syncRequests.status} = 'running'
        then 'The cloud run stopped answering.'
        else 'The cloud run never started. Check the Cloud sync workflow on GitHub.' end`,
      finishedAt: now,
    })
    .where(
      or(
        and(
          eq(syncRequests.status, "running"),
          lt(syncRequests.startedAt, new Date(now.getTime() - RUNNING_TIMEOUT_MS))
        ),
        and(
          eq(syncRequests.status, "pending"),
          lt(syncRequests.requestedAt, new Date(now.getTime() - PENDING_TIMEOUT_MS))
        )
      )
    )
}

/**
 * Ask for a sync of one account, of every active account of a prop firm, or of all active accounts.
 * A request already waiting or running is returned instead of stacking another.
 */
export async function requestSync(
  scope: { accountId?: string | null; firm?: string | null } = {}
): Promise<SyncRequest> {
  await expireStale()
  const [open] = await db
    .select()
    .from(syncRequests)
    .where(inArray(syncRequests.status, ["pending", "running"]))
    .orderBy(desc(syncRequests.requestedAt))
    .limit(1)
  if (open) return open
  const [created] = await db
    .insert(syncRequests)
    .values({ accountId: scope.accountId ?? null, firm: scope.firm ?? null })
    .returning()
  return created
}

/** The cloud run's call: hand it the oldest waiting request, marked running (null when none). */
export async function claimNextRequest(now = new Date()): Promise<{ request: SyncRequest | null }> {
  await expireStale(now)
  const [claimed] = await db
    .update(syncRequests)
    .set({ status: "running", startedAt: now })
    .where(
      and(
        eq(syncRequests.status, "pending"),
        eq(
          syncRequests.id,
          db
            .select({ id: syncRequests.id })
            .from(syncRequests)
            .where(eq(syncRequests.status, "pending"))
            .orderBy(syncRequests.requestedAt)
            .limit(1)
        )
      )
    )
    .returning()
  return { request: claimed ?? null }
}

/** The accounts a request covers, each with the period its export has to span. */
export async function syncTargets(request: SyncRequest, now = new Date()): Promise<SyncTarget[]> {
  const rows = await db
    .select()
    .from(accounts)
    .where(
      request.accountId
        ? eq(accounts.id, request.accountId)
        : and(
            eq(accounts.status, "active"),
            request.firm
              ? sql`lower(trim(${accounts.firm})) = ${request.firm.trim().toLowerCase()}`
              : undefined
          )
    )
  if (rows.length === 0) return []
  const lastFills = await db
    .select({ accountId: fills.accountId, last: max(fills.timestamp) })
    .from(fills)
    .where(
      inArray(
        fills.accountId,
        rows.map((account) => account.id)
      )
    )
    .groupBy(fills.accountId)
  const lastFillAt = new Map(lastFills.map((row) => [row.accountId, row.last]))
  return rows.map((account) => ({
    id: account.id,
    name: account.name,
    firm: account.firm,
    tradovateName: account.tradovateName,
    loginKey: accountLoginKey(account),
    ...syncWindow(
      { lastImportedAt: account.lastImportedAt, lastFillAt: lastFillAt.get(account.id) ?? null },
      now
    ),
  }))
}

/** Give up on the waiting or running request (the cloud run's next call to it is refused). */
export async function cancelOpenRequests(): Promise<number> {
  const closed = await db
    .update(syncRequests)
    .set({ status: "failed", message: CANCELLED_MESSAGE, finishedAt: new Date() })
    .where(inArray(syncRequests.status, ["pending", "running"]))
    .returning({ id: syncRequests.id })
  return closed.length
}

/** A request the cloud run is working on, or null when the id is unknown or already closed. */
export async function getRunningRequest(id: string): Promise<SyncRequest | null> {
  const [request] = await db
    .select()
    .from(syncRequests)
    .where(and(eq(syncRequests.id, id), eq(syncRequests.status, "running")))
  return request ?? null
}

/** Close a running request with its outcome. Returns false when it was not running. */
export async function finishRequest(
  id: string,
  status: "done" | "failed" | "needs_login",
  message: string
): Promise<boolean> {
  const updated = await db
    .update(syncRequests)
    .set({ status, message: message.slice(0, MESSAGE_MAX_LENGTH), finishedAt: new Date() })
    .where(and(eq(syncRequests.id, id), eq(syncRequests.status, "running")))
    .returning({ id: syncRequests.id })
  return updated.length > 0
}

/** What the Import page shows: the latest request (closing the ones nobody works on any more). */
export async function getSyncOverview(now = new Date()) {
  await expireStale(now)
  const [latest] = await db
    .select()
    .from(syncRequests)
    .orderBy(desc(syncRequests.requestedAt))
    .limit(1)
  return { latest: latest ?? null }
}

/** The latest syncs, newest first, with the name of the account when one was asked for. */
export async function getSyncHistory(limit = 6) {
  return db
    .select({
      id: syncRequests.id,
      accountId: syncRequests.accountId,
      accountName: accounts.name,
      firm: syncRequests.firm,
      status: syncRequests.status,
      message: syncRequests.message,
      requestedAt: syncRequests.requestedAt,
      finishedAt: syncRequests.finishedAt,
    })
    .from(syncRequests)
    .leftJoin(accounts, eq(syncRequests.accountId, accounts.id))
    .orderBy(desc(syncRequests.requestedAt))
    .limit(limit)
}

/**
 * What the cloud run saw of each account in its Tradovate login. A missing account keeps the day it was
 * first missed; one that is found again is cleared. Nothing else about the account changes.
 */
export async function recordPresence(found: string[], missing: string[], now = new Date()) {
  if (missing.length > 0) {
    await db
      .update(accounts)
      .set({ notFoundAt: now })
      .where(and(inArray(accounts.id, missing), sql`${accounts.notFoundAt} is null`))
  }
  if (found.length > 0) {
    await db.update(accounts).set({ notFoundAt: null }).where(inArray(accounts.id, found))
  }
}

/**
 * Accounts exported without error and that had nothing to import: the data is as
 * complete as Tradovate's, so they count as imported now (an account that did not trade has no
 * fill to import, which would otherwise leave it "late" forever).
 */
export async function recordEmptyImports(ids: string[], now = new Date()) {
  if (ids.length === 0) return
  await db.update(accounts).set({ lastImportedAt: now }).where(inArray(accounts.id, ids))
}
