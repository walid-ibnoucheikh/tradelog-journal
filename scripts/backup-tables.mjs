import { neon } from "@neondatabase/serverless"

/** Parents first, so a restore never meets a foreign key to a row that is not there yet. */
export const TABLES = [
  "accounts",
  "fills",
  "cash_fees",
  "trades",
  "day_notes",
  "transactions",
  "note_folders",
  "notes",
  "note_images",
  "tradovate_logins",
]

/** What the first backups held: a restore accepts a file that only has these (older backups). */
export const ORIGINAL_TABLES = ["accounts", "fills", "trades", "day_notes", "transactions"]

/** Working data of the sync (queue, agent heartbeat): rebuilt on its own, not worth keeping. */
export const NOT_BACKED_UP = ["sync_requests", "sync_agent"]

/** The primary key of each table: tables are read, and put back, in slices ordered by it. */
export const TABLE_KEYS = {
  accounts: "id",
  fills: "id",
  cash_fees: "id",
  trades: "id",
  day_notes: "day",
  transactions: "id",
  note_folders: "id",
  notes: "id",
  note_images: "id",
  tradovate_logins: "firm_key",
}

/**
 * Rows per slice. Neon answers a query with at most 64 MB, and cash fees alone reach that within two
 * years of day trading: nothing is read or written in one piece. Pictures weigh up to 4 MB each.
 * `BACKUP_CHUNK_ROWS` lowers it (tests).
 */
/** @param {string} table @param {Record<string, string | undefined>} [env] */
export function chunkRows(table, env = process.env) {
  const forced = Number(env.BACKUP_CHUNK_ROWS)
  if (Number.isInteger(forced) && forced > 0) return forced
  return table === "note_images" ? 5 : 10_000
}

/** `BACKUP_SCHEMA` points the scripts at another schema of the database (to try a restore safely). */
/** @param {string} table @param {Record<string, string | undefined>} [env] */
export function qualified(table, env = process.env) {
  const schema = env.BACKUP_SCHEMA
  if (!schema) return `"${table}"`
  if (!/^[a-z_][a-z0-9_]*$/.test(schema)) throw new Error("BACKUP_SCHEMA is not a valid name.")
  return `"${schema}"."${table}"`
}

export function connect() {
  try {
    process.loadEnvFile(".env.local")
  } catch {
    // The variable may already be set in the environment (GitHub Actions).
  }
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set")
  return neon(process.env.DATABASE_URL)
}
