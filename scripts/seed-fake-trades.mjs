// Fake trades for the Neon `test` branch, to look at charts and lists with a long history.
//   node scripts/seed-fake-trades.mjs          creates (or recreates) the fake account and its trades
//   node scripts/seed-fake-trades.mjs clear    removes the fake account and its trades
//   node scripts/seed-fake-trades.mjs --dry    prints what it would create, touches nothing
// It reads TEST_DATABASE_URL from .env.test.local only, never DATABASE_URL, and refuses to run if the two
// are the same address. Everything it writes belongs to one account named by FAKE_TRADOVATE_NAME.
import { neon } from "@neondatabase/serverless"

const FAKE_TRADOVATE_NAME = "ZZ-FAKE-DEMO"
const TRADING_TIMEZONE = "America/New_York"
const DAYS_BACK = 190
const POINT_VALUE = 2 // MNQ: $2 a point

// A small deterministic generator: the same fake history every time.
function random(seed) {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

const pad = (value) => String(value).padStart(2, "0")

/** The UTC instant of a New York wall-clock time (handles summer and winter time). */
function newYorkToUtc(day, hour, minute) {
  const [year, month, date] = day.split("-").map(Number)
  const hourIn = new Intl.DateTimeFormat("en-US", {
    timeZone: TRADING_TIMEZONE,
    hour: "2-digit",
    hourCycle: "h23",
  })
  for (const offset of [4, 5]) {
    const candidate = new Date(Date.UTC(year, month - 1, date, hour + offset, minute))
    if (Number(hourIn.format(candidate)) === hour) return candidate
  }
  throw new Error(`No New York time for ${day} ${hour}:${minute}`)
}

/** Weekdays from `daysBack` days ago up to today. */
function tradingDays(daysBack) {
  const days = []
  const today = new Date()
  for (let back = daysBack; back >= 0; back--) {
    const date = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate() - back))
    const weekday = date.getUTCDay()
    if (weekday === 0 || weekday === 6) continue
    days.push(`${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`)
  }
  return days
}

/** One to six trades a day, most days small, a few big losses. */
export function fakeTrades(days = tradingDays(DAYS_BACK)) {
  const next = random(20260101)
  const trades = []
  let counter = 0
  for (const day of days) {
    if (next() < 0.12) continue // a day without trading
    const count = 1 + Math.floor(next() * 6)
    let minute = 9 * 60 + 30 + Math.floor(next() * 30)
    for (let index = 0; index < count; index++) {
      const quantity = 1 + Math.floor(next() * 4)
      const long = next() < 0.55
      const entry = 27000 + Math.round(next() * 2500 * 4) / 4
      // Points gained: a profitable trader (about 6 trades in 10 win), small losses, a few big ones.
      const roll = next()
      const points =
        roll < 0.34 ? -(6 + next() * 16) : roll < 0.96 ? 4 + next() * 28 : -(30 + next() * 30)
      const move = Math.round(points * 4) / 4
      const exit = entry + (long ? move : -move)
      const gross = Math.round(move * POINT_VALUE * quantity * 100) / 100
      const commission = Math.round(quantity * 1.04 * 100) / 100
      const hold = 1 + Math.floor(next() * 25)
      const opened = newYorkToUtc(day, Math.floor(minute / 60), minute % 60)
      const closed = new Date(opened.getTime() + hold * 60_000)
      minute += hold + 2 + Math.floor(next() * 20)
      if (minute > 15 * 60 + 40) break
      counter += 1
      trades.push({
        contract: "MNQZ6",
        product: "MNQ",
        direction: long ? "Long" : "Short",
        openedAt: opened.toISOString(),
        closedAt: closed.toISOString(),
        quantity,
        avgEntry: entry,
        avgExit: exit,
        grossPnl: gross,
        commission,
        netPnl: Math.round((gross - commission) * 100) / 100,
        fillIds: [`FAKE-${counter}-a`, `FAKE-${counter}-b`],
      })
    }
  }
  return trades
}

function connect() {
  try {
    process.loadEnvFile(".env.test.local")
  } catch {
    // Without the file, TEST_DATABASE_URL may still be in the environment.
  }
  const url = process.env.TEST_DATABASE_URL
  if (!url) throw new Error("TEST_DATABASE_URL is missing: it is read from .env.test.local")
  if (process.env.DATABASE_URL && process.env.DATABASE_URL === url) {
    throw new Error("TEST_DATABASE_URL is the same address as DATABASE_URL: refusing to run")
  }
  return neon(url)
}

async function clear(sql) {
  // The trades follow the account (on delete cascade).
  const removed = await sql.query("delete from accounts where tradovate_name = $1 returning id", [
    FAKE_TRADOVATE_NAME,
  ])
  return removed.length
}

async function seed(sql, trades) {
  await clear(sql)
  const [account] = await sql.query(
    `insert into accounts (name, firm, type, tradovate_name, initial_balance, status)
     values ($1, 'Fake', 'eval', $2, 50000, 'active') returning id`,
    ["ZZ Fake demo (test data)", FAKE_TRADOVATE_NAME]
  )
  const columns =
    "account_id, contract, product, direction, opened_at, closed_at, quantity, avg_entry, avg_exit, gross_pnl, commission, net_pnl, fill_ids"
  for (let from = 0; from < trades.length; from += 100) {
    const slice = trades.slice(from, from + 100)
    const params = []
    const rows = slice.map((trade) => {
      const base = params.length
      params.push(
        account.id,
        trade.contract,
        trade.product,
        trade.direction,
        trade.openedAt,
        trade.closedAt,
        trade.quantity,
        trade.avgEntry,
        trade.avgExit,
        trade.grossPnl,
        trade.commission,
        trade.netPnl,
        trade.fillIds
      )
      const marks = Array.from({ length: 13 }, (_, index) => `$${base + index + 1}`)
      marks[12] += "::text[]"
      return `(${marks.join(", ")})`
    })
    await sql.query(`insert into trades (${columns}) values ${rows.join(", ")}`, params)
  }
  return account.id
}

const args = process.argv.slice(2)
const trades = fakeTrades()
const days = new Set(trades.map((trade) => trade.closedAt.slice(0, 10)))

if (args.includes("--dry")) {
  console.log(`Would create ${trades.length} trades over about ${days.size} trading days.`)
  console.log(`First: ${trades[0].openedAt}  Last: ${trades[trades.length - 1].openedAt}`)
} else if (args.includes("clear")) {
  const sql = connect()
  console.log(`Removed ${await clear(sql)} fake account(s) and their trades.`)
} else {
  const sql = connect()
  await seed(sql, trades)
  console.log(
    `Created account "${FAKE_TRADOVATE_NAME}" with ${trades.length} trades over about ${days.size} days.`
  )
  console.log(
    "Pages are cached for up to a minute: reload after that. Remove with: node scripts/seed-fake-trades.mjs clear"
  )
}
