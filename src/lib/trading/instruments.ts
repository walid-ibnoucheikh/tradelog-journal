export interface Instrument {
  /** Dollar value of one full point of price movement. */
  pointValue: number
  tickSize: number
}

const INSTRUMENTS: Record<string, Instrument> = {
  NQ: { pointValue: 20, tickSize: 0.25 },
  MNQ: { pointValue: 2, tickSize: 0.25 },
}

/** `product` is the Tradovate root symbol, e.g. "MNQ" (not the contract "MNQZ6"). */
export function getInstrument(product: string): Instrument {
  const instrument = INSTRUMENTS[product]
  if (!instrument) throw new Error(`Unsupported product: ${product}`)
  return instrument
}
