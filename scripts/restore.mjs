// Reloads a backup into an EMPTY database. Run: npm run restore -- backups/tradelog-YYYY-MM-DD.json
// Rows go back in slices (a request to Neon is limited in size), so a failure part-way leaves the
// database partly filled: empty it again before retrying.
import { readFileSync } from "node:fs"
import { ORIGINAL_TABLES, TABLES, chunkRows, connect, qualified } from "./backup-tables.mjs"

const file = process.argv[2]
if (!file) throw new Error("Usage: npm run restore -- <fichier de sauvegarde>")

const backup = JSON.parse(readFileSync(file, "utf8"))
const has = (table) => Array.isArray(backup.tables?.[table])
for (const table of ORIGINAL_TABLES) {
  if (!has(table)) throw new Error(`Table absente du fichier : ${table}`)
}
// A backup made before a table existed (fees, notes...) simply has nothing for it.
const tables = TABLES.filter(has)
for (const table of TABLES.filter((name) => !has(name))) {
  console.log(`  ${table}: absente de cette sauvegarde (ancienne), laissée vide`)
}

const sql = connect()
for (const table of tables) {
  const [{ count }] = await sql.query(`select count(*)::int as count from ${qualified(table)}`)
  if (count > 0) {
    throw new Error(`La table ${table} n'est pas vide : la restauration vise une base vide.`)
  }
}

// jsonb_populate_recordset turns the JSON back into typed rows, whatever the column order.
for (const table of tables) {
  const rows = backup.tables[table]
  const size = chunkRows(table)
  for (let from = 0; from < rows.length; from += size) {
    await sql.query(
      `insert into ${qualified(table)} select * from jsonb_populate_recordset(null::${qualified(table)}, $1::jsonb)`,
      [JSON.stringify(rows.slice(from, from + size))]
    )
  }
}

console.log(`Base restaurée depuis ${file}`)
for (const table of tables) console.log(`  ${table}: ${backup.tables[table].length}`)
