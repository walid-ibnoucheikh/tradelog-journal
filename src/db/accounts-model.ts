import { cacheLife, cacheTag } from "next/cache"
import { buildAccountView, summarizeAccounts } from "@/lib/accounts/account-views"
import { accountSuggestions } from "@/lib/accounts/suggestions"
import { buildInvestmentReport } from "@/lib/investments/investment-report"
import { DATA_TAG } from "./cache"
import {
  getAccountDataCounts,
  getTradeResultsByAccount,
  listAccounts,
  listTransactions,
} from "./queries"

const noContents = { trades: 0, fills: 0, fees: 0, transactions: 0 }

/**
 * Everything the Accounts page shows, built once and kept until data is written. The time ("now") is
 * read in here, not in the page: a page that reads the clock cannot be prerendered or prefetched, so
 * it would wait behind a loading state at every visit. The figures that depend on the day are at most
 * a minute old.
 */
export async function getAccountsModel() {
  "use cache"
  cacheTag(DATA_TAG)
  cacheLife({ stale: 30, revalidate: 60, expire: 60 * 60 })

  const [rows, results, counts, transactions] = await Promise.all([
    listAccounts(),
    getTradeResultsByAccount(),
    getAccountDataCounts(),
    listTransactions(),
  ])
  const now = new Date()
  // The investments report already knows what each account cost and when it was opened.
  const money = new Map(
    buildInvestmentReport({ accounts: rows, transactions, tradingPnl: new Map() }).accountRows.map(
      (row) => [row.id, row]
    )
  )
  const views = rows.map((account) =>
    buildAccountView(
      account,
      results.get(account.id) ?? [],
      now,
      counts.get(account.id) ?? noContents,
      money.get(account.id) ?? {
        cost: 0,
        payouts: 0,
        net: 0,
        openedOn: account.createdAt.toISOString().slice(0, 10),
      }
    )
  )
  const active = views.filter((view) => view.status === "active")
  return {
    empty: rows.length === 0,
    active,
    ended: views.filter((view) => view.status !== "active"),
    summary: summarizeAccounts(active),
    suggestions: accountSuggestions(rows, results),
    now: now.toISOString(),
  }
}
