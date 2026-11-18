/** Rows per page, for every paginated list (Trades, and the day / week / month reports). */
export const PAGE_SIZE = 25

/** The `?page=` value as a whole number, or null when it is missing or not a number. */
export function parsePage(value: string | string[] | undefined): number | null {
  const page = Number(Array.isArray(value) ? value[0] : value)
  return Number.isInteger(page) ? page : null
}

/** One page of a list, the requested page being kept inside the list (a missing one is the first). */
export function paginate<T>(items: T[], requestedPage: number | null, pageSize = PAGE_SIZE) {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize))
  const page = requestedPage === null ? 1 : Math.min(Math.max(requestedPage, 1), pageCount)
  return { page, pageCount, visible: items.slice((page - 1) * pageSize, page * pageSize) }
}
