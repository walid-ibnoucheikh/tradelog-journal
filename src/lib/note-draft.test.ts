import { describe, expect, it } from "vitest"
import { draftIsNewer, draftKey, parseDraft } from "./note-draft"

const saved = {
  content: '{"type":"doc"}',
  title: "T",
  folderId: null,
  updatedAt: "2026-11-05T10:00:00.000Z",
}
const draft = (patch: object = {}) => ({
  json: saved.content,
  title: "T",
  folderId: null,
  at: Date.parse("2026-11-05T11:00:00.000Z"),
  ...patch,
})

describe("draftKey", () => {
  it("is one key per note, whatever its kind", () => {
    expect(draftKey("free", "a")).not.toBe(draftKey("day", "a"))
    expect(draftKey("free", "a")).not.toBe(draftKey("free", "b"))
  })
})

describe("parseDraft", () => {
  it("reads a stored draft", () => {
    expect(parseDraft(JSON.stringify(draft()))).toEqual(draft())
  })

  it("ignores nothing, garbage and drafts of another shape", () => {
    expect(parseDraft(null)).toBeNull()
    expect(parseDraft("")).toBeNull()
    expect(parseDraft("not json")).toBeNull()
    expect(parseDraft(JSON.stringify({ json: 1 }))).toBeNull()
    expect(parseDraft(JSON.stringify({ ...draft(), at: "yesterday" }))).toBeNull()
  })
})

describe("draftIsNewer", () => {
  it("is true when typed after the last save and different", () => {
    expect(draftIsNewer(draft({ json: '{"type":"doc","x":1}' }), saved)).toBe(true)
    expect(draftIsNewer(draft({ title: "Other" }), saved)).toBe(true)
    expect(draftIsNewer(draft({ folderId: "f1" }), saved)).toBe(true)
  })

  it("is false when the server already has it, or has something more recent", () => {
    expect(draftIsNewer(draft(), saved)).toBe(false)
    expect(
      draftIsNewer(draft({ json: "x", at: Date.parse("2026-11-05T09:00:00.000Z") }), saved)
    ).toBe(false)
  })
})
