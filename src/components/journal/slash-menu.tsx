"use client"

import type { Editor } from "@tiptap/react"
import {
  Code2,
  Heading1,
  Heading2,
  Heading3,
  ImagePlus,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Pilcrow,
  Quote,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"

export interface SlashItem {
  id: string
  label: string
  hint: string
  icon: LucideIcon
  /** Extra words that also find the item ("h1" finds Heading 1). */
  keywords: string
  run: (editor: Editor, tools: { pickImage: () => void }) => void
}

/** Blocks offered when typing "/" at the start of an empty line, like in Notion. */
export const SLASH_ITEMS: SlashItem[] = [
  {
    id: "text",
    label: "Text",
    hint: "Plain paragraph",
    icon: Pilcrow,
    keywords: "paragraph p",
    run: (e) => e.chain().focus().setParagraph().run(),
  },
  {
    id: "h1",
    label: "Heading 1",
    hint: "Big section title",
    icon: Heading1,
    keywords: "h1 title",
    run: (e) => e.chain().focus().setHeading({ level: 1 }).run(),
  },
  {
    id: "h2",
    label: "Heading 2",
    hint: "Medium section title",
    icon: Heading2,
    keywords: "h2 subtitle",
    run: (e) => e.chain().focus().setHeading({ level: 2 }).run(),
  },
  {
    id: "h3",
    label: "Heading 3",
    hint: "Small section title",
    icon: Heading3,
    keywords: "h3",
    run: (e) => e.chain().focus().setHeading({ level: 3 }).run(),
  },
  {
    id: "bullets",
    label: "Bulleted list",
    hint: "A simple list",
    icon: List,
    keywords: "bullet ul",
    run: (e) => e.chain().focus().toggleBulletList().run(),
  },
  {
    id: "numbers",
    label: "Numbered list",
    hint: "Steps in order",
    icon: ListOrdered,
    keywords: "number ol",
    run: (e) => e.chain().focus().toggleOrderedList().run(),
  },
  {
    id: "tasks",
    label: "To-do list",
    hint: "Checkboxes to tick off",
    icon: ListChecks,
    keywords: "task todo checklist",
    run: (e) => e.chain().focus().toggleTaskList().run(),
  },
  {
    id: "quote",
    label: "Quote",
    hint: "Set a thought apart",
    icon: Quote,
    keywords: "blockquote",
    run: (e) => e.chain().focus().toggleBlockquote().run(),
  },
  {
    id: "code",
    label: "Code block",
    hint: "Monospaced text",
    icon: Code2,
    keywords: "code snippet",
    run: (e) => e.chain().focus().toggleCodeBlock().run(),
  },
  {
    id: "divider",
    label: "Divider",
    hint: "A line between sections",
    icon: Minus,
    keywords: "rule hr line",
    run: (e) => e.chain().focus().setHorizontalRule().run(),
  },
  {
    id: "picture",
    label: "Picture",
    hint: "Upload an image",
    icon: ImagePlus,
    keywords: "image photo screenshot",
    run: (_e, tools) => tools.pickImage(),
  },
]

/** The items matching what was typed after the "/". */
export function filterSlash(query: string): SlashItem[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return SLASH_ITEMS
  return SLASH_ITEMS.filter((item) => {
    const haystack = `${item.label} ${item.keywords}`.toLowerCase()
    return words.every((word) => haystack.includes(word))
  })
}

/** Floating list of blocks, placed under the "/" being typed. */
export function SlashMenu({
  items,
  index,
  left,
  top,
  onPick,
  onHover,
}: {
  items: SlashItem[]
  index: number
  left: number
  top: number
  onPick: (item: SlashItem) => void
  onHover: (index: number) => void
}) {
  // Near the bottom of the window the list opens upwards instead of being cut off.
  const below = top + 320 < window.innerHeight
  return (
    <div
      role="listbox"
      aria-label="Insert a block"
      style={{
        left: Math.min(left, window.innerWidth - 280),
        top: below ? top + 6 : undefined,
        bottom: below ? undefined : window.innerHeight - top + 26,
      }}
      className="fixed z-[70] max-h-80 w-64 overflow-y-auto rounded-xl border bg-popover p-1.5 shadow-xl"
    >
      {items.map((item, position) => (
        <button
          key={item.id}
          type="button"
          role="option"
          aria-selected={position === index}
          // The editor keeps the focus: the click must not take it.
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onPick(item)}
          onMouseMove={() => onHover(position)}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left",
            position === index && "bg-primary/10"
          )}
        >
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border bg-background text-muted-foreground [&_svg]:size-4">
            <item.icon />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-medium">{item.label}</span>
            <span className="block truncate text-xs text-muted-foreground">{item.hint}</span>
          </span>
        </button>
      ))}
    </div>
  )
}
