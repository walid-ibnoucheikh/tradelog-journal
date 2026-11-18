import { getTableName, is } from "drizzle-orm"
import { PgTable, getTableConfig } from "drizzle-orm/pg-core"
import { describe, expect, it } from "vitest"
import * as schema from "@/db/schema"
import {
  NOT_BACKED_UP,
  ORIGINAL_TABLES,
  TABLES,
  TABLE_KEYS,
  chunkRows,
  qualified,
} from "./backup-tables.mjs"

describe("backup tables", () => {
  it("covers every table of the schema, so a new table is never left out of a backup", () => {
    const inSchema = Object.values(schema)
      .filter((value) => is(value, PgTable))
      .map((table) => getTableName(table))
      .sort()
    expect([...TABLES, ...NOT_BACKED_UP].sort()).toEqual(inSchema)
  })

  it("lists parents before the tables that point to them, and keeps the original tables", () => {
    const at = (name: string) => TABLES.indexOf(name)
    expect(at("accounts")).toBeLessThan(at("fills"))
    expect(at("accounts")).toBeLessThan(at("cash_fees"))
    expect(at("accounts")).toBeLessThan(at("trades"))
    expect(at("accounts")).toBeLessThan(at("transactions"))
    expect(at("note_folders")).toBeLessThan(at("notes"))
    for (const table of ORIGINAL_TABLES) expect(TABLES).toContain(table)
  })

  it("slices every table by its real primary key", () => {
    for (const table of Object.values(schema).filter((value) => is(value, PgTable))) {
      const name = getTableName(table)
      if (!TABLES.includes(name)) continue
      const keys = getTableConfig(table).columns.filter((column) => column.primary)
      expect(
        keys.map((column) => column.name),
        name
      ).toEqual([TABLE_KEYS[name as keyof typeof TABLE_KEYS]])
    }
    expect(Object.keys(TABLE_KEYS).sort()).toEqual([...TABLES].sort())
  })

  it("reads pictures a few at a time and the rest by the thousand", () => {
    expect(chunkRows("note_images", {})).toBe(5)
    expect(chunkRows("cash_fees", {})).toBe(10_000)
    expect(chunkRows("cash_fees", { BACKUP_CHUNK_ROWS: "7" })).toBe(7)
    expect(chunkRows("cash_fees", { BACKUP_CHUNK_ROWS: "nope" })).toBe(10_000)
  })

  it("points at another schema only with a valid name", () => {
    expect(qualified("trades", {})).toBe('"trades"')
    expect(qualified("trades", { BACKUP_SCHEMA: "zz_restore" })).toBe('"zz_restore"."trades"')
    expect(() => qualified("trades", { BACKUP_SCHEMA: 'x"; drop table y;--' })).toThrow()
  })
})
