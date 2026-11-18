import { refresh, revalidateTag, updateTag } from "next/cache"

/**
 * One tag for every cached read of trading data (accounts, trades, money, notes). The data changes a
 * few times a day and is read all the time, so the pages are built once and served from the cache
 * until something is written. Every write must drop it: `afterWrite` in a Server Action,
 * `invalidateData` in a route handler (a test checks that no action forgets).
 */
export const DATA_TAG = "trading-data"

/** End of a Server Action that changed data: drop the cache (read-your-own-writes) and redraw the page. */
export function afterWrite() {
  updateTag(DATA_TAG)
  refresh()
}

/** For route handlers (the cloud sync's import), where `updateTag` is not available. */
export function invalidateData() {
  revalidateTag(DATA_TAG, { expire: 0 })
}

/**
 * How long a cached page may be served. Writes drop it at once (see DATA_TAG); this only bounds the
 * figures that depend on the day or the hour ("today", "x ago"), which are at most a minute old.
 * `stale` is how long the browser may keep a prefetched page without asking again.
 */
export const PAGE_CACHE = { stale: 30, revalidate: 60, expire: 60 * 60 } as const
