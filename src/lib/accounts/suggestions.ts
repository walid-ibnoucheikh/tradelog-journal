import { dayKey } from "../trading/stats"
import { findBreach, type AccountRules, type Breach } from "./account-rules"

export interface SuggestionAccount extends AccountRules {
  id: string
  name: string
  firm: string
  status: "active" | "blown" | "closed"
  /** When the cloud sync first did not find the account in its Tradovate login; null while it does. */
  notFoundAt: Date | null
}

interface Base {
  id: string
  name: string
  firm: string
  /** Day of the last trade; the end date when the account is marked ended without a breach to go by. */
  lastTradeDay: string | null
}

/**
 * - blown: the balance reached the liquidation threshold on `day` and nothing was traded after it;
 * - missing: the cloud sync no longer finds the account in Tradovate.
 */
export type Suggestion =
  | (Base & { kind: "blown"; day: string; balance: number; threshold: number; missing: boolean })
  | (Base & { kind: "missing"; since: string })

/**
 * Active accounts that look finished, for the person to confirm. Nothing is changed here: realized
 * P&L cannot see an open position, and an account that went on trading after the breach was most
 * likely reset, so it is not offered as blown.
 */
export function accountSuggestions(
  accounts: SuggestionAccount[],
  results: Map<string, { closedAt: Date; netPnl: number }[]>
): Suggestion[] {
  const suggestions: Suggestion[] = []
  for (const account of accounts) {
    if (account.status !== "active") continue
    const trades = results.get(account.id) ?? []
    const lastTrade = trades.reduce<Date | null>(
      (latest, trade) => (latest === null || trade.closedAt > latest ? trade.closedAt : latest),
      null
    )
    const base: Base = {
      id: account.id,
      name: account.name,
      firm: account.firm,
      lastTradeDay: lastTrade ? dayKey(lastTrade) : null,
    }
    const breach: Breach | null = findBreach(account, trades)
    if (breach && base.lastTradeDay === breach.day) {
      suggestions.push({ ...base, kind: "blown", ...breach, missing: account.notFoundAt !== null })
    } else if (account.notFoundAt) {
      suggestions.push({ ...base, kind: "missing", since: dayKey(account.notFoundAt) })
    }
  }
  return suggestions
}
