"use client"

import { useState } from "react"
import { noteText, type NoteNode } from "@/lib/note"
import { templatesFor, type TemplateKind } from "@/lib/note-templates"
import { NoteEditor } from "./note-editor"

/**
 * The note editor of a journal day or a trade, with templates to start from while the note is empty
 * (a Trade review lands on the trade itself, a Day review on the day). A template replaces the empty note.
 */
export function TemplatedNoteEditor({
  kind,
  initial,
  label,
  maxLength,
  onChange,
}: {
  kind: Exclude<TemplateKind, "free">
  initial: NoteNode
  label: string
  maxLength: number
  onChange: (json: string, length: number) => void
}) {
  const [seed, setSeed] = useState<{ doc: NoteNode; version: number } | null>(null)
  const [typed, setTyped] = useState(noteText(initial).trim().length > 0)

  return (
    <div className="grid grid-cols-1 gap-2 [&>*]:min-w-0">
      {!typed && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Start from a template:</span>
          {templatesFor(kind).map((template) => (
            <button
              key={template.id}
              type="button"
              title={template.description}
              onClick={() => {
                setSeed({ doc: template.doc, version: (seed?.version ?? 0) + 1 })
                onChange(JSON.stringify(template.doc), noteText(template.doc).trim().length)
              }}
              className="rounded-lg border px-2.5 py-1 text-xs font-medium hover:border-primary/50 hover:bg-primary/5"
            >
              {template.name}
            </button>
          ))}
        </div>
      )}
      <NoteEditor
        // A new version rebuilds the editor with the template as its content.
        key={seed?.version ?? 0}
        initial={seed?.doc ?? initial}
        label={label}
        maxLength={maxLength}
        onChange={(json, length) => {
          setTyped(length > 0)
          onChange(json, length)
        }}
      />
    </div>
  )
}
