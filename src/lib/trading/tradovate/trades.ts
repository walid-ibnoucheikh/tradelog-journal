import { getInstrument } from "../instruments"
import type { Fill } from "./fills"

export type Direction = "Long" | "Short"

export interface Trade {
  account: string
  contract: string
  product: string
  direction: Direction
  openedAt: Date
  closedAt: Date
  /** Total contracts entered (scale-ins included). */
  quantity: number
  avgEntry: number
  avgExit: number
  grossPnl: number
  commission: number
  netPnl: number
  fillIds: string[]
}

export interface OpenPosition {
  account: string
  contract: string
  product: string
  direction: Direction
  quantity: number
  avgEntry: number
  openedAt: Date
}

interface Lot {
  quantity: number
  price: number
}

interface Building {
  direction: Direction
  openedAt: Date
  lots: Lot[]
  entryQty: number
  entryCost: number
  exitQty: number
  exitCost: number
  points: number
  commission: number
  fillIds: string[]
}

const round2 = (value: number) => Math.round(value * 100) / 100

/**
 * Rebuild trades from fills. A trade runs from a flat position back to flat,
 * so scale-ins and partial exits belong to one trade, and a fill that flips the
 * position closes one trade and opens the next. P&L is matched FIFO per
 * account and contract.
 */
export function buildTrades(fills: Fill[]): {
  trades: Trade[]
  openPositions: OpenPosition[]
} {
  const groups = new Map<string, Fill[]>()
  for (const fill of fills) {
    const key = `${fill.account}|${fill.contract}`
    groups.set(key, [...(groups.get(key) ?? []), fill])
  }

  const trades: Trade[] = []
  const openPositions: OpenPosition[] = []
  for (const group of groups.values()) {
    const result = buildGroup(group)
    trades.push(...result.trades)
    if (result.open) openPositions.push(result.open)
  }
  trades.sort((a, b) => a.openedAt.getTime() - b.openedAt.getTime())
  return { trades, openPositions }
}

function buildGroup(fills: Fill[]) {
  const { account, contract, product } = fills[0]
  const { pointValue } = getInstrument(product)
  const trades: Trade[] = []
  let current: Building | null = null

  const finish = (trade: Building, closedAt: Date) => {
    const grossPnl = round2(trade.points * pointValue)
    const commission = round2(trade.commission)
    trades.push({
      account,
      contract,
      product,
      direction: trade.direction,
      openedAt: trade.openedAt,
      closedAt,
      quantity: trade.entryQty,
      avgEntry: trade.entryCost / trade.entryQty,
      avgExit: trade.exitCost / trade.exitQty,
      grossPnl,
      commission,
      netPnl: round2(grossPnl - commission),
      fillIds: trade.fillIds,
    })
  }

  for (const fill of fills) {
    const direction: Direction = fill.side === "Buy" ? "Long" : "Short"
    const commissionPerContract = fill.commission / fill.quantity
    let remaining = fill.quantity

    while (remaining > 0) {
      if (!current) {
        current = {
          direction,
          openedAt: fill.timestamp,
          lots: [],
          entryQty: 0,
          entryCost: 0,
          exitQty: 0,
          exitCost: 0,
          points: 0,
          commission: 0,
          fillIds: [],
        }
      }
      if (!current.fillIds.includes(fill.id)) current.fillIds.push(fill.id)

      if (current.direction === direction) {
        current.commission += commissionPerContract * remaining
        current.lots.push({ quantity: remaining, price: fill.price })
        current.entryQty += remaining
        current.entryCost += remaining * fill.price
        remaining = 0
        continue
      }

      let toClose = Math.min(remaining, openQuantity(current))
      current.commission += commissionPerContract * toClose
      remaining -= toClose
      current.exitQty += toClose
      current.exitCost += toClose * fill.price
      while (toClose > 0) {
        const lot = current.lots[0]
        const take = Math.min(lot.quantity, toClose)
        const move = current.direction === "Long" ? fill.price - lot.price : lot.price - fill.price
        current.points += move * take
        lot.quantity -= take
        toClose -= take
        if (lot.quantity === 0) current.lots.shift()
      }
      if (current.lots.length === 0) {
        finish(current, fill.timestamp)
        current = null
      }
    }
  }

  const open: OpenPosition | null = current
    ? {
        account,
        contract,
        product,
        direction: current.direction,
        quantity: openQuantity(current),
        avgEntry:
          current.lots.reduce((sum, lot) => sum + lot.quantity * lot.price, 0) /
          openQuantity(current),
        openedAt: current.openedAt,
      }
    : null
  return { trades, open }
}

function openQuantity(trade: Building) {
  return trade.lots.reduce((sum, lot) => sum + lot.quantity, 0)
}
