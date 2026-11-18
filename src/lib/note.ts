/** Rich text of the notes (journal, trades, notebook): Tiptap's JSON document, stored as a string. */
export interface NoteNode {
  type: string
  attrs?: Record<string, unknown>
  content?: NoteNode[]
  text?: string
  marks?: { type: string; attrs?: Record<string, unknown> }[]
}

export const MAX_NOTE_LENGTH = 50_000
/** A stored note, images included, is only their addresses: this caps the document itself. */
export const MAX_NOTE_JSON_LENGTH = 600_000

const MAX_DEPTH = 10
const MAX_NODES = 5000
const PLAIN_MARKS = new Set(["bold", "italic", "underline", "strike"])
const BLOCKS = [
  "paragraph",
  "heading",
  "blockquote",
  "bulletList",
  "orderedList",
  "taskList",
  "codeBlock",
  "horizontalRule",
  "image",
]
/** What each node may contain: anything else is dropped, so a stored note can only hold what the editor offers. */
const CHILDREN: Record<string, string[]> = {
  doc: BLOCKS,
  paragraph: ["text", "hardBreak"],
  heading: ["text", "hardBreak"],
  codeBlock: ["text"],
  blockquote: BLOCKS,
  bulletList: ["listItem"],
  orderedList: ["listItem"],
  taskList: ["taskItem"],
  listItem: BLOCKS,
  taskItem: BLOCKS,
}

/** Address of a picture saved by `/api/note-images`: the only image source a note may hold. */
export const NOTE_IMAGE_PATTERN =
  /^\/api\/note-images\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const COLOR_PATTERN = /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i
const LINK_PATTERN = /^(?:https?:\/\/|mailto:)\S{1,2000}$/i
const ALIGNMENTS = new Set(["left", "center", "right"])

/** A mark rebuilt with only the attributes it may carry, or null when it is not allowed or its value is unsafe. */
function cleanMark(mark: unknown): { type: string; attrs?: Record<string, unknown> } | null {
  if (typeof mark !== "object" || mark === null) return null
  const { type, attrs } = mark as { type?: unknown; attrs?: Record<string, unknown> }
  if (typeof type !== "string") return null
  if (PLAIN_MARKS.has(type)) return { type }
  if (type === "link") {
    const href = attrs?.href
    return typeof href === "string" && LINK_PATTERN.test(href) ? { type, attrs: { href } } : null
  }
  if (type === "textStyle" || type === "highlight") {
    const color = attrs?.color
    return typeof color === "string" && COLOR_PATTERN.test(color)
      ? { type, attrs: { color } }
      : null
  }
  return null
}

function cleanNode(value: unknown, parent: string, depth: number, budget: { left: number }) {
  if (typeof value !== "object" || value === null || depth > MAX_DEPTH || budget.left-- <= 0) {
    return null
  }
  const node = value as NoteNode
  if (typeof node.type !== "string" || !CHILDREN[parent]?.includes(node.type)) return null

  if (node.type === "text") {
    if (typeof node.text !== "string" || node.text === "") return null
    // Code blocks hold plain text: no formatting inside.
    const marks =
      parent === "codeBlock"
        ? []
        : (Array.isArray(node.marks) ? node.marks : [])
            .map(cleanMark)
            .filter((mark): mark is NonNullable<typeof mark> => mark !== null)
    return marks.length
      ? { type: "text", text: node.text, marks }
      : { type: "text", text: node.text }
  }
  if (node.type === "hardBreak") return { type: "hardBreak" }
  if (node.type === "horizontalRule") return { type: "horizontalRule" }
  if (node.type === "image") {
    const src = node.attrs?.src
    if (typeof src !== "string" || !NOTE_IMAGE_PATTERN.test(src)) return null
    const alt = node.attrs?.alt
    // The size the picture was dragged to (pixels); anything out of range falls back to its natural size.
    const size = (value: unknown) =>
      typeof value === "number" && Number.isFinite(value) && value >= 40 && value <= 4000
        ? { value: Math.round(value) }
        : null
    const width = size(node.attrs?.width)
    const height = size(node.attrs?.height)
    const align = node.attrs?.align
    return {
      type: "image",
      attrs: {
        src,
        ...(typeof alt === "string" && alt ? { alt: alt.slice(0, 200) } : {}),
        ...(width && height ? { width: width.value, height: height.value } : {}),
        ...(align === "center" || align === "right" ? { align } : {}),
      },
    }
  }

  const content = (Array.isArray(node.content) ? node.content : [])
    .map((child) => cleanNode(child, node.type, depth + 1, budget))
    .filter((child): child is NoteNode => child !== null)
  const clean: NoteNode = { type: node.type }
  if (node.type === "heading") {
    const level = Number(node.attrs?.level)
    clean.attrs = { level: level >= 1 && level <= 3 ? Math.floor(level) : 2 }
  }
  if (node.type === "paragraph" || node.type === "heading") {
    const align = node.attrs?.textAlign
    if (typeof align === "string" && ALIGNMENTS.has(align) && align !== "left") {
      clean.attrs = { ...clean.attrs, textAlign: align }
    }
  }
  if (node.type === "taskItem") clean.attrs = { checked: node.attrs?.checked === true }
  if (node.type === "orderedList") {
    const start = Number(node.attrs?.start)
    clean.attrs = { start: Number.isInteger(start) && start > 0 && start < 10000 ? start : 1 }
  }
  if (content.length) clean.content = content
  return clean
}

/** The document rebuilt from the allowed nodes and marks only, or null when it is not a note document. */
export function cleanNote(value: unknown): NoteNode | null {
  if (typeof value !== "object" || value === null || (value as NoteNode).type !== "doc") return null
  const content = (Array.isArray((value as NoteNode).content) ? (value as NoteNode).content! : [])
    .map((child) => cleanNode(child, "doc", 1, { left: MAX_NODES }))
    .filter((child): child is NoteNode => child !== null)
  return content.length ? { type: "doc", content } : { type: "doc" }
}

/** Plain text of a document, one line per block; used for the length limit. */
export function noteText(node: NoteNode): string {
  if (node.type === "text") return node.text ?? ""
  if (node.type === "hardBreak") return "\n"
  const inline = node.type === "paragraph" || node.type === "heading" || node.type === "codeBlock"
  return (node.content ?? []).map(noteText).join(inline ? "" : "\n")
}

/** True when the note holds a picture or a divider: such a note has no text but is not empty. */
function hasMedia(node: NoteNode): boolean {
  return (
    node.type === "image" || node.type === "horizontalRule" || (node.content ?? []).some(hasMedia)
  )
}

/** A note with no text, no picture and no divider counts as no note at all. */
export function noteIsEmpty(node: NoteNode): boolean {
  return noteText(node).trim() === "" && !hasMedia(node)
}

/** Document to show in the editor. Notes saved before the rich editor are plain text: one paragraph per line. */
export function parseNote(raw: string | null): NoteNode {
  if (!raw) return { type: "doc", content: [{ type: "paragraph" }] }
  try {
    const doc = cleanNote(JSON.parse(raw))
    if (doc) return doc
  } catch {
    // Not JSON: a plain-text note.
  }
  return {
    type: "doc",
    content: raw
      .split("\n")
      .map((line) =>
        line
          ? { type: "paragraph", content: [{ type: "text", text: line }] }
          : { type: "paragraph" }
      ),
  }
}

/**
 * What a form sends as a note: the JSON of the editor, or nothing. Returns the document to store ("" when
 * the note is empty, which means there is no note) or the error to show.
 */
export function readNote(value: FormDataEntryValue | null): { error: string } | { note: string } {
  if (typeof value !== "string" || !value.trim()) return { note: "" }
  let doc: NoteNode | null = null
  try {
    doc = cleanNote(JSON.parse(value))
  } catch {
    doc = null
  }
  if (!doc) return { error: "Invalid note." }
  if (noteText(doc).trim().length > MAX_NOTE_LENGTH) {
    return { error: `The note is limited to ${MAX_NOTE_LENGTH} characters.` }
  }
  const note = noteIsEmpty(doc) ? "" : JSON.stringify(doc)
  if (note.length > MAX_NOTE_JSON_LENGTH) return { error: "The note is too large." }
  return { note }
}
