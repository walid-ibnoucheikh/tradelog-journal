import { signedAmount, type TransactionType } from "./investments"
import { monthKey, parseMonth, shiftMonth } from "../month"

interface SeriesTransaction {
  day: string
  type: TransactionType
  amount: number
}

const round2 = (value: number) => Math.round(value * 100) / 100

/** Running net cash (payouts minus costs) at the end of each day that has a transaction. */
export function cumulativeNet(
  transactions: SeriesTransaction[]
): { date: string; value: number }[] {
  const byDay = new Map<string, number>()
  for (const transaction of transactions) {
    byDay.set(transaction.day, (byDay.get(transaction.day) ?? 0) + signedAmount(transaction))
  }
  let running = 0
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, change]) => {
      running = round2(running + change)
      return { date, value: running }
    })
}

/**
 * The day net cash last went from negative back to zero or above, or null when it is still
 * negative or was never negative.
 */
export function breakEvenDay(series: { date: string; value: number }[]): string | null {
  if (series.length === 0 || series[series.length - 1].value < 0) return null
  let day: string | null = null
  for (let index = 1; index < series.length; index++) {
    if (series[index - 1].value < 0 && series[index].value >= 0) day = series[index].date
  }
  return day
}

/** Costs and payouts per calendar month, with empty months filled in between the first and last. */
export function monthlyCash(
  transactions: SeriesTransaction[]
): { month: string; spent: number; payouts: number }[] {
  if (transactions.length === 0) return []
  const totals = new Map<string, { spent: number; payouts: number }>()
  for (const transaction of transactions) {
    const key = transaction.day.slice(0, 7)
    const total = totals.get(key) ?? { spent: 0, payouts: 0 }
    if (transaction.type === "payout") total.payouts += transaction.amount
    else total.spent += transaction.amount
    totals.set(key, total)
  }

  const keys = [...totals.keys()].sort()
  const last = keys[keys.length - 1]
  const first = parseMonth(keys[0])!
  const months: { month: string; spent: number; payouts: number }[] = []
  for (
    let key = monthKey(first.year, first.month), delta = 0;
    key <= last;
    key = shiftMonth(first.year, first.month, ++delta)
  ) {
    const total = totals.get(key)
    months.push({
      month: key,
      spent: round2(total?.spent ?? 0),
      payouts: round2(total?.payouts ?? 0),
    })
  }
  return months
}
