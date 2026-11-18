import { USER_TIMEZONE } from "./day"
import { TRADING_TIMEZONE } from "./trading/stats"

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
})

const compactUsd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
})

export function formatUsd(value: number): string {
  return usd.format(value)
}

/** "$1.2K" for axes and dense cells. */
export function formatCompactUsd(value: number): string {
  return compactUsd.format(value)
}

/**
 * The amount of a calendar cell on a phone, where a cell is about 40 px wide: whole dollars, and "1.2k"
 * from a thousand ("-$642", "$569", "$1.2k").
 */
export function formatPhoneAmount(value: number): string {
  const sign = value < 0 ? "-" : ""
  const size = Math.abs(value)
  if (size >= 1000) return `${sign}$${(size / 1000).toFixed(size >= 10_000 ? 0 : 1)}k`
  return `${sign}$${Math.round(size)}`
}

export function formatPercent(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(2)}%`
}

/** "15 Oct" from a YYYY-MM-DD string, independent of the viewer's timezone. */
export function formatDay(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  })
}

/** "15 Oct 2026" from a YYYY-MM-DD string. */
export function formatDayYear(date: string): string {
  return `${formatDay(date)} ${date.slice(0, 4)}`
}

/** "Fri, 23 October 2026" from a YYYY-MM-DD string. */
export function formatLongDay(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  })
}

/** "27 Oct, 23:10 GMT+1" in Walid's own timezone, for moments such as an import. */
export function formatImportTime(date: Date): string {
  return date.toLocaleString("en-GB", {
    timeZone: USER_TIMEZONE,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZoneName: "short",
  })
}

/** "Sep 26" from a YYYY-MM string. */
export function formatMonth(month: string): string {
  return new Date(`${month}-01T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  })
}

/** "October 2026" from a YYYY-MM string. */
export function formatLongMonth(month: string): string {
  return new Date(`${month}-01T12:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  })
}

/** Text color class for a profit or loss amount. */
export function pnlColor(value: number): string {
  return value > 0 ? "text-profit-text" : value < 0 ? "text-loss-text" : "text-foreground"
}

const price = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Futures price with two decimals and thousands separators, e.g. "29,785.75". */
export function formatPrice(value: number): string {
  return price.format(value)
}

/** "28/10/2026, 09:31" in the trading timezone; `seconds` adds ":42". */
export function formatDateTime(date: Date, seconds = false): string {
  return date.toLocaleString("en-GB", {
    timeZone: TRADING_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: seconds ? "2-digit" : undefined,
    hourCycle: "h23",
  })
}

/** "2 h 05 min", "4 min 12 s" or "38 s". */
/** The time of day in trading time (24 h, with seconds), for a list that already shows the date. */
export function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-GB", {
    timeZone: TRADING_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  })
}

export function formatDuration(milliseconds: number): string {
  const total = Math.max(0, Math.round(milliseconds / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  if (hours > 0) return `${hours} h ${String(minutes).padStart(2, "0")} min`
  if (minutes > 0) return `${minutes} min ${String(seconds).padStart(2, "0")} s`
  return `${seconds} s`
}

/** "840 B", "12 KB" or "1.2 MB". */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toLocaleString("en-US", { maximumFractionDigits: 1 })} MB`
}
