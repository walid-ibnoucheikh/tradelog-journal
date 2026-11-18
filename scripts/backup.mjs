// Exports every table to backups/tradelog-YYYY-MM-DD.json. Run: npm run backup
// Tables are read in slices ordered by their primary key (see backup-tables.mjs).
import { mkdirSync, writeFileSync } from "node:fs"
import { TABLES, TABLE_KEYS, chunkRows, connect, qualified } from "./backup-tables.mjs"

const sql = connect()

/**
 * Every row of a table as JSON. to_jsonb lets Postgres write dates and timestamps itself: read
 * through the driver, a date would become a local-time JavaScript Date and shift by a day on restore.
 */
async function readTable(table) {
  const key = `"${TABLE_KEYS[table]}"`
  const size = chunkRows(table)
  const rows = []
  let last = null
  for (;;) {
    const slice =
      last === null
        ? await sql.query(
            `select to_jsonb(t) as row, t.${key}::text as k from ${qualified(table)} t order by t.${key} limit ${size}`
          )
        : await sql.query(
            `select to_jsonb(t) as row, t.${key}::text as k from ${qualified(table)} t where t.${key} > $1 order by t.${key} limit ${size}`,
            [last]
          )
    for (const { row } of slice) rows.push(row)
    if (slice.length < size) return rows
    last = slice[slice.length - 1].k
  }
}

const data = {}
for (const table of TABLES) data[table] = await readTable(table)

const file = `backups/tradelog-${new Date().toISOString().slice(0, 10)}.json`
mkdirSync("backups", { recursive: true, mode: 0o700 })
writeFileSync(file, JSON.stringify({ exportedAt: new Date().toISOString(), tables: data }), {
  mode: 0o600,
})

console.log(`Sauvegarde écrite dans ${file}`)
for (const table of TABLES) console.log(`  ${table}: ${data[table].length}`)
