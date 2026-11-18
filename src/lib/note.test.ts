import { describe, expect, it } from "vitest"
import { cleanNote, noteIsEmpty, noteText, parseNote, readNote, type NoteNode } from "./note"

const paragraph = (text: string): NoteNode => ({
  type: "paragraph",
  content: [{ type: "text", text }],
})

describe("cleanNote", () => {
  it("keeps what the editor offers: formatting, headings, lists and tasks", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Plan" }] },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "gras", marks: [{ type: "bold" }, { type: "underline" }] },
          ],
        },
        { type: "blockquote", content: [paragraph("citation")] },
        { type: "bulletList", content: [{ type: "listItem", content: [paragraph("a")] }] },
        {
          type: "taskList",
          content: [{ type: "taskItem", attrs: { checked: true }, content: [paragraph("fait")] }],
        },
      ],
    }
    expect(cleanNote(doc)).toEqual(doc)
  })

  it("drops anything else: unknown nodes, marks, attributes and links", () => {
    const cleaned = cleanNote({
      type: "doc",
      content: [
        { type: "image", attrs: { src: "javascript:alert(1)" } },
        {
          type: "paragraph",
          attrs: { onclick: "x" },
          content: [
            {
              type: "text",
              text: "lien",
              marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
            },
          ],
        },
        { type: "heading", attrs: { level: 9 }, content: [{ type: "text", text: "t" }] },
      ],
    })
    expect(cleaned).toEqual({
      type: "doc",
      content: [
        paragraph("lien"),
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "t" }] },
      ],
    })
  })

  it("refuses a node placed where it does not belong", () => {
    const cleaned = cleanNote({
      type: "doc",
      content: [{ type: "bulletList", content: [paragraph("sans listItem")] }],
    })
    expect(cleaned).toEqual({ type: "doc", content: [{ type: "bulletList" }] })
  })

  it("rejects values that are not a document", () => {
    expect(cleanNote(null)).toBeNull()
    expect(cleanNote("texte")).toBeNull()
    expect(cleanNote({ type: "paragraph" })).toBeNull()
  })
})

describe("noteText", () => {
  it("gives one line per block, so the length limit matches what is typed", () => {
    const doc = cleanNote({
      type: "doc",
      content: [
        paragraph("un"),
        { type: "bulletList", content: [{ type: "listItem", content: [paragraph("deux")] }] },
      ],
    })!
    expect(noteText(doc)).toBe("un\ndeux")
  })
})

describe("parseNote", () => {
  it("reads a stored rich note", () => {
    const doc = { type: "doc", content: [paragraph("bonjour")] }
    expect(parseNote(JSON.stringify(doc))).toEqual(doc)
  })

  it("turns a note saved as plain text into paragraphs, keeping the blank lines", () => {
    expect(parseNote("ligne 1\n\nligne 3")).toEqual({
      type: "doc",
      content: [paragraph("ligne 1"), { type: "paragraph" }, paragraph("ligne 3")],
    })
  })

  it("starts an empty note with one empty paragraph", () => {
    expect(parseNote(null)).toEqual({ type: "doc", content: [{ type: "paragraph" }] })
  })
})

const IMAGE = "/api/note-images/0b9f3a52-6c1e-4a8e-9d0b-2f4a7c1d8e90"

describe("cleanNote rich content", () => {
  it("keeps pictures from our own store, links, colors, highlights, alignment and code", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "image", attrs: { src: IMAGE, alt: "setup" } },
        {
          type: "paragraph",
          attrs: { textAlign: "center" },
          content: [
            {
              type: "text",
              text: "rouge",
              marks: [
                { type: "textStyle", attrs: { color: "#dc2626" } },
                { type: "highlight", attrs: { color: "#fef08a" } },
                { type: "link", attrs: { href: "https://example.com/a" } },
                { type: "strike" },
              ],
            },
          ],
        },
        { type: "codeBlock", content: [{ type: "text", text: "const a = 1" }] },
        { type: "horizontalRule" },
      ],
    }
    expect(cleanNote(doc)).toEqual(doc)
  })

  it("refuses pictures from anywhere else and unsafe attribute values", () => {
    const cleaned = cleanNote({
      type: "doc",
      content: [
        { type: "image", attrs: { src: "https://evil.example/pixel.png" } },
        { type: "image", attrs: { src: "/api/note-images/../../secret" } },
        {
          type: "paragraph",
          attrs: { textAlign: "justify" },
          content: [
            {
              type: "text",
              text: "x",
              marks: [
                { type: "textStyle", attrs: { color: "red; background:url(x)" } },
                { type: "highlight", attrs: { color: "expression(1)" } },
                { type: "link", attrs: { href: "data:text/html,<script>" } },
              ],
            },
          ],
        },
      ],
    })
    expect(cleaned).toEqual({ type: "doc", content: [paragraph("x")] })
  })

  it("keeps no formatting inside a code block", () => {
    const cleaned = cleanNote({
      type: "doc",
      content: [
        {
          type: "codeBlock",
          content: [{ type: "text", text: "a", marks: [{ type: "bold" }] }],
        },
      ],
    })
    expect(cleaned).toEqual({
      type: "doc",
      content: [{ type: "codeBlock", content: [{ type: "text", text: "a" }] }],
    })
  })
})

describe("noteIsEmpty", () => {
  it("is empty without text, picture or divider", () => {
    expect(noteIsEmpty({ type: "doc", content: [{ type: "paragraph" }] })).toBe(true)
  })

  it("is not empty with only a picture", () => {
    expect(noteIsEmpty({ type: "doc", content: [{ type: "image", attrs: { src: IMAGE } }] })).toBe(
      false
    )
  })

  it("is not empty with text", () => {
    expect(noteIsEmpty({ type: "doc", content: [paragraph("a")] })).toBe(false)
  })
})

describe("readNote", () => {
  it("keeps a note and cleans it", () => {
    const sent = JSON.stringify({ type: "doc", content: [paragraph("hello")] })
    expect(readNote(sent)).toEqual({ note: sent })
  })

  it("turns an empty note or no value into no note", () => {
    expect(readNote(null)).toEqual({ note: "" })
    expect(readNote("  ")).toEqual({ note: "" })
    expect(readNote(JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] }))).toEqual({
      note: "",
    })
  })

  it("refuses what is not a note document", () => {
    expect(readNote("{not json")).toEqual({ error: "Invalid note." })
    expect(readNote(JSON.stringify({ type: "other" }))).toEqual({ error: "Invalid note." })
  })

  it("refuses a note over the length limit", () => {
    const long = JSON.stringify({ type: "doc", content: [paragraph("a".repeat(50_001))] })
    expect(readNote(long)).toEqual({ error: "The note is limited to 50000 characters." })
  })
})

describe("cleanNote picture size", () => {
  const picture = (attrs: Record<string, unknown>) =>
    cleanNote({ type: "doc", content: [{ type: "image", attrs: { src: IMAGE, ...attrs } }] })

  it("keeps the size a picture was dragged to", () => {
    expect(picture({ width: 320.4, height: 180 })).toEqual({
      type: "doc",
      content: [{ type: "image", attrs: { src: IMAGE, width: 320, height: 180 } }],
    })
  })

  it("drops sizes that are missing, absurd or not numbers", () => {
    const natural = { type: "doc", content: [{ type: "image", attrs: { src: IMAGE } }] }
    expect(picture({ width: 320 })).toEqual(natural)
    expect(picture({ width: 1, height: 1 })).toEqual(natural)
    expect(picture({ width: 99_999, height: 200 })).toEqual(natural)
    expect(picture({ width: "300px", height: "100px" })).toEqual(natural)
  })
})

describe("cleanNote picture alignment", () => {
  const aligned = (align: unknown) =>
    cleanNote({ type: "doc", content: [{ type: "image", attrs: { src: IMAGE, align } }] })

  it("keeps a centered or right-aligned picture and drops anything else", () => {
    expect(aligned("center")).toEqual({
      type: "doc",
      content: [{ type: "image", attrs: { src: IMAGE, align: "center" } }],
    })
    expect(aligned("right")).toMatchObject({ content: [{ attrs: { align: "right" } }] })
    const left = { type: "doc", content: [{ type: "image", attrs: { src: IMAGE } }] }
    expect(aligned("left")).toEqual(left)
    expect(aligned("float: left")).toEqual(left)
  })
})
