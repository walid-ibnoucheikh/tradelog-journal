/**
 * A window over a long series of bars: the last `size` bars by default, moved back and forth by whole
 * windows. `offset` counts the bars hidden after the window, so 0 is the most recent one.
 */
export interface WindowRange {
  /** Index of the first bar shown. */
  start: number
  /** Index after the last bar shown. */
  end: number
  /** The offset really used, once kept inside the series. */
  offset: number
  hasOlder: boolean
  hasNewer: boolean
}

export function windowRange(total: number, size: number, offset: number): WindowRange {
  const maxOffset = Math.max(0, total - size)
  const used = Math.min(Math.max(0, Math.trunc(offset) || 0), maxOffset)
  const end = total - used
  const start = Math.max(0, end - size)
  return { start, end, offset: used, hasOlder: start > 0, hasNewer: used > 0 }
}
