export type TradovateFileKind = "fills" | "cash"

/**
 * Which Tradovate export a CSV is, from its header line: `Fills.csv` (the executions) or `Cash History.csv`
 * (the fees). Anything else, such as `Orders.csv` or a file from another broker, is null.
 */
export function detectTradovateFile(text: string): TradovateFileKind | null {
  const header = text.replace(/^﻿/, "").split(/\r?\n/, 1)[0] ?? ""
  const columns = header.split(",").map((column) => column.trim().replace(/^"|"$/g, ""))
  if (columns.includes("Fill ID") && columns.includes("B/S")) return "fills"
  if (columns.includes("Transaction ID") && columns.includes("Cash Change Type")) return "cash"
  return null
}
