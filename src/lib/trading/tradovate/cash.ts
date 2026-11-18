import { parseCsv } from "../../csv"

/** One fee Tradovate charged for a fill, from `Cash History.csv`. */
export interface CashFee {
  /** Tradovate transaction ID, unique, so re-importing a file never duplicates. */
  id: string
  account: string
  /** Full contract symbol, e.g. "MNQZ6". */
  contract: string
  /** As labelled by Tradovate: "Commission", "Exchange Fee", "Clearing Fee", "Nfa Fee"... */
  type: string
  /** Cost in dollars: positive for a charge, negative for a rebate. */
  amount: number
  /** Tradovate's local time ("10/15/2026 15:03:49"), the same clock as `Fill.localTime`. */
  localTime: string
}

const REQUIRED_COLUMNS = [
  "Account",
  "Transaction ID",
  "Timestamp",
  "Delta",
  "Cash Change Type",
  "Contract",
]

export class CashCsvError extends Error {}

/**
 * Whether a Cash History line is a fee. The file also holds deposits, resets, payouts and the
 * P&L of paired trades. Any "... Fee" counts, so a new prop firm or fee type needs no change.
 */
function isFee(type: string) {
  return type === "Commission" || /\bfee$/i.test(type)
}

/** The fees of a Tradovate `Cash History.csv` export; every other kind of line is ignored. */
export function parseCashFeesCsv(text: string): CashFee[] {
  const records = parseCsv(text)
  const columns = Object.keys(records[0] ?? {})
  const missing = REQUIRED_COLUMNS.filter((column) => !columns.includes(column))
  if (records.length > 0 && missing.length > 0) {
    throw new CashCsvError(
      `Not a Tradovate Cash History export, missing columns: ${missing.join(", ")}`
    )
  }

  const fees = new Map<string, CashFee>()
  for (const record of records) {
    const type = record["Cash Change Type"]
    if (!isFee(type)) continue
    const delta = Number(record["Delta"].replace(/,/g, ""))
    if (Number.isNaN(delta)) {
      throw new CashCsvError(
        `Invalid amount "${record["Delta"]}" for transaction ${record["Transaction ID"]}`
      )
    }
    fees.set(record["Transaction ID"], {
      id: record["Transaction ID"],
      account: record["Account"],
      contract: record["Contract"],
      type,
      amount: Math.round(-delta * 100) / 100 || 0,
      localTime: record["Timestamp"],
    })
  }
  return [...fees.values()]
}
