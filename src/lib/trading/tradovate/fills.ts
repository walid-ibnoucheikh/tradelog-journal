import { parseCsv } from "../../csv"

export type Side = "Buy" | "Sell"

export interface Fill {
  id: string
  orderId: string
  account: string
  /** Full contract symbol, e.g. "MNQZ6". */
  contract: string
  /** Root symbol, e.g. "MNQ". */
  product: string
  side: Side
  quantity: number
  price: number
  commission: number
  timestamp: Date
  /**
   * Tradovate's `Timestamp` column as written, in the exporting user's local time
   * ("10/15/2026 15:03:49"). Cash History uses the same clock, which is how fees find their fill.
   */
  localTime: string
  /** Trading date as reported by Tradovate (YYYY-MM-DD). */
  tradeDate: string
}

const REQUIRED_COLUMNS = [
  "Fill ID",
  "Order ID",
  "_timestamp",
  "Timestamp",
  "_tradeDate",
  "Account",
  "B/S",
  "Quantity",
  "Price",
  "Contract",
  "Product",
  "commission",
]

export class FillsCsvError extends Error {}

/**
 * Parse a Tradovate `Fills.csv` export. Duplicate fill IDs are dropped and the
 * result is sorted chronologically. Uses the UTC `_timestamp` column, since
 * `Timestamp` is in the exporting user's local time.
 */
export function parseFillsCsv(text: string): Fill[] {
  const records = parseCsv(text)
  const columns = Object.keys(records[0] ?? {})
  const missing = REQUIRED_COLUMNS.filter((column) => !columns.includes(column))
  if (records.length > 0 && missing.length > 0) {
    throw new FillsCsvError(`Not a Tradovate Fills export, missing columns: ${missing.join(", ")}`)
  }

  const fills = new Map<string, Fill>()
  for (const record of records) {
    const fill = toFill(record)
    fills.set(fill.id, fill)
  }
  return [...fills.values()].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime() || Number(a.id) - Number(b.id)
  )
}

function toFill(record: Record<string, string>): Fill {
  const side = record["B/S"]
  if (side !== "Buy" && side !== "Sell") {
    throw new FillsCsvError(`Unknown side "${side}" for fill ${record["Fill ID"]}`)
  }
  const timestamp = new Date(record["_timestamp"].replace(" ", "T"))
  if (Number.isNaN(timestamp.getTime())) {
    throw new FillsCsvError(`Invalid timestamp for fill ${record["Fill ID"]}`)
  }
  return {
    id: record["Fill ID"],
    orderId: record["Order ID"],
    account: record["Account"],
    contract: record["Contract"],
    product: record["Product"],
    side,
    quantity: toNumber(record["Quantity"]),
    price: toNumber(record["Price"]),
    commission: toNumber(record["commission"]),
    timestamp,
    localTime: record["Timestamp"],
    tradeDate: record["_tradeDate"],
  }
}

function toNumber(value: string): number {
  const number = Number(value.replace(/,/g, ""))
  if (Number.isNaN(number)) throw new FillsCsvError(`Invalid number "${value}"`)
  return number
}
