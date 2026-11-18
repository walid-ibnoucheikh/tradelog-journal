export type SortDirection = "asc" | "desc"

/** Rows sorted by a value; rows without a value (null) always come last. The sort is stable. */
export function sortRows<T>(
  rows: T[],
  value: (row: T) => string | number | null,
  direction: SortDirection
): T[] {
  const sign = direction === "asc" ? 1 : -1
  return [...rows].sort((a, b) => {
    const left = value(a)
    const right = value(b)
    if (left === null && right === null) return 0
    if (left === null) return 1
    if (right === null) return -1
    if (typeof left === "string" && typeof right === "string") {
      return sign * left.localeCompare(right, "en", { sensitivity: "base" })
    }
    return sign * (Number(left) - Number(right))
  })
}
