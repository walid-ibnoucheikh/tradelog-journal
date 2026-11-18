import { describe, expect, it } from "vitest"
import { cleanNote } from "./note"
import { NOTE_TEMPLATES, templatesFor } from "./note-templates"

describe("NOTE_TEMPLATES", () => {
  it("has unique ids and titles", () => {
    expect(new Set(NOTE_TEMPLATES.map((t) => t.id)).size).toBe(NOTE_TEMPLATES.length)
    for (const template of NOTE_TEMPLATES) expect(template.title).not.toBe("")
  })

  it("only uses what a note may hold, so saving a template changes nothing", () => {
    for (const template of NOTE_TEMPLATES) {
      expect(cleanNote(JSON.parse(JSON.stringify(template.doc)))).toEqual(template.doc)
    }
  })
})

describe("templatesFor", () => {
  it("offers each kind of note the templates that suit it", () => {
    expect(templatesFor("free").map((t) => t.id)).toEqual([
      "pre-market",
      "setup-review",
      "weekly-review",
    ])
    expect(templatesFor("day").map((t) => t.id)).toEqual(["pre-market", "day-review"])
    expect(templatesFor("trade").map((t) => t.id)).toEqual(["trade-review"])
  })
})
