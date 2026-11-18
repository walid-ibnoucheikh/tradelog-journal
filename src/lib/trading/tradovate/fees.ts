import type { CashFee } from "./cash"
import type { Fill } from "./fills"

/** How many seconds after a fill Tradovate may book its fees. Observed: 0 or 1. */
const MAX_DELAY_SECONDS = 2

const cents = (value: number) => Math.round(value * 100) / 100

/** "10/15/2026 15:03:49" as seconds on a clock without time zone, so 1 s later is +1. */
function seconds(localTime: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})$/.exec(localTime)
  if (!match) return null
  const [, month, day, year, hour, minute, second] = match.map(Number)
  return Date.UTC(year, month - 1, day, hour, minute, second) / 1000
}

function groupBy<T>(items: T[], key: (item: T) => string | null) {
  const groups = new Map<string, T[]>()
  for (const item of items) {
    const k = key(item)
    if (k !== null) groups.set(k, [...(groups.get(k) ?? []), item])
  }
  return groups
}

/**
 * Replace each fill's commission by the fees Tradovate really charged, from Cash History.
 * Fills carry only the broker commission; exchange, clearing, NFA and other fees are booked
 * apart, with no fill ID, so a fill is found by account, contract and time (the fees arrive
 * 0 or 1 s after the fill). Fills of the same second share one set of fees, split by quantity.
 * A fill with no fees found keeps its own commission. `matched` counts the fills that got fees.
 */
export function applyCashFees(fills: Fill[], fees: CashFee[]): { fills: Fill[]; matched: number } {
  const feeGroups = groupBy(fees, (fee) => {
    const at = seconds(fee.localTime)
    return at === null ? null : `${fee.account}|${fee.contract}|${at}`
  })
  const fillGroups = groupBy(fills, (fill) => {
    const at = seconds(fill.localTime)
    return at === null ? null : `${fill.account}|${fill.contract}|${at}`
  })

  const commissions = new Map<string, number>()
  const unmatched = new Set(fillGroups.keys())
  // Closest delay first: a fee row belongs to the fill group that is nearest before it.
  for (let delay = 0; delay <= MAX_DELAY_SECONDS; delay++) {
    for (const key of [...unmatched]) {
      const [account, contract, at] = key.split("|")
      const feeKey = `${account}|${contract}|${Number(at) + delay}`
      const group = feeGroups.get(feeKey)
      if (!group) continue
      feeGroups.delete(feeKey)
      unmatched.delete(key)

      const members = fillGroups.get(key)!
      const total = cents(group.reduce((sum, fee) => sum + fee.amount, 0))
      const quantity = members.reduce((sum, fill) => sum + fill.quantity, 0)
      let left = total
      members.forEach((fill, index) => {
        const share =
          index === members.length - 1 ? cents(left) : cents((total * fill.quantity) / quantity)
        left -= share
        commissions.set(fill.id, share)
      })
    }
  }

  return {
    fills: fills.map((fill) =>
      commissions.has(fill.id) ? { ...fill, commission: commissions.get(fill.id)! } : fill
    ),
    matched: commissions.size,
  }
}
