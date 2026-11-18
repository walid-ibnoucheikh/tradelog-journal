import type { NoteNode } from "./note"

/** Where a template can start a note: a free note of the Notebook, the note of a journal day, or of a trade. */
export type TemplateKind = "free" | "day" | "trade"

export interface NoteTemplate {
  id: string
  /** The kinds of note it suits. */
  kinds: TemplateKind[]
  name: string
  description: string
  /** Title the new note starts with. */
  title: string
  doc: NoteNode
}

const text = (value: string): NoteNode => ({ type: "text", text: value })
const paragraph = (value = ""): NoteNode =>
  value ? { type: "paragraph", content: [text(value)] } : { type: "paragraph" }
const heading = (value: string): NoteNode => ({
  type: "heading",
  attrs: { level: 2 },
  content: [text(value)],
})
const bullets = (...items: string[]): NoteNode => ({
  type: "bulletList",
  content: items.map((item) => ({ type: "listItem", content: [paragraph(item)] })),
})
const tasks = (...items: string[]): NoteNode => ({
  type: "taskList",
  content: items.map((item) => ({
    type: "taskItem",
    attrs: { checked: false },
    content: [paragraph(item)],
  })),
})
const doc = (...content: NoteNode[]): NoteNode => ({ type: "doc", content })

/** Starting points for a note: the structure is there, the thinking is yours. */
export const NOTE_TEMPLATES: NoteTemplate[] = [
  {
    id: "pre-market",
    kinds: ["free", "day"],
    name: "Pre-market plan",
    description: "Context, levels and rules for the session",
    title: "Pre-market plan",
    doc: doc(
      heading("Market context"),
      paragraph(),
      heading("Levels to watch"),
      bullets("", ""),
      heading("Setups I will take"),
      bullets("", ""),
      heading("Rules for today"),
      tasks("Stop after the daily loss limit", "No revenge trades", "Size down after two losses")
    ),
  },
  {
    id: "day-review",
    kinds: ["day"],
    name: "Day review",
    description: "How the day went and what to keep",
    title: "Day review",
    doc: doc(
      heading("How the day went"),
      paragraph(),
      heading("What I did well"),
      bullets("", ""),
      heading("What I would change"),
      bullets("", ""),
      heading("Lesson of the day"),
      paragraph()
    ),
  },
  {
    id: "trade-review",
    kinds: ["trade"],
    name: "Trade review",
    description: "Setup, execution and what to change",
    title: "Trade review",
    doc: doc(
      heading("What I saw"),
      paragraph("Paste the chart here."),
      heading("Why I entered"),
      paragraph(),
      heading("Execution"),
      bullets("Entry", "Stop", "Exit"),
      heading("What I would do differently"),
      paragraph()
    ),
  },
  {
    id: "setup-review",
    kinds: ["free"],
    name: "Setup review",
    description: "A setup you trade: why it works and its rules",
    title: "Setup review",
    doc: doc(
      heading("The setup"),
      paragraph("Paste an example chart here."),
      heading("Why it works"),
      paragraph(),
      heading("Rules to take it"),
      tasks("", "", ""),
      heading("Examples"),
      paragraph()
    ),
  },
  {
    id: "weekly-review",
    kinds: ["free"],
    name: "Weekly review",
    description: "Results, lessons and next week's focus",
    title: "Weekly review",
    doc: doc(
      heading("Results"),
      paragraph(),
      heading("What worked"),
      bullets("", ""),
      heading("What to fix"),
      bullets("", ""),
      heading("Focus for next week"),
      tasks("", "")
    ),
  },
]

/** The templates that suit a kind of note. */
export function templatesFor(kind: TemplateKind): NoteTemplate[] {
  return NOTE_TEMPLATES.filter((template) => template.kinds.includes(kind))
}
