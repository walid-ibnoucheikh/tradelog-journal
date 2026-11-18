"use client"

import type { Editor } from "@tiptap/react"
import {
  Bold,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Quote,
  Redo2,
  Strikethrough,
  Type,
  Underline,
  Undo2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { HIGHLIGHTS, TEXT_COLORS } from "./toolbar-colors"

/** A 44 px touch button. It keeps the focus in the note, so the keyboard stays open. */
function Tool({
  label,
  active,
  disabled,
  onClick,
  className,
  children,
}: {
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  className?: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        "inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-foreground disabled:opacity-35 [&_svg]:size-5",
        active && "bg-primary/15 text-primary",
        className
      )}
    >
      {children}
    </button>
  )
}

/** One row of the format panel: equal-width buttons. */
const Row = ({ children }: { children: React.ReactNode }) => (
  <div className="grid auto-cols-fr grid-flow-col gap-1.5">{children}</div>
)

/** A format button with a text label (the paragraph styles). */
function Pill({
  label,
  active,
  onClick,
  className,
}: {
  label: string
  active: boolean
  onClick: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        "flex h-11 items-center justify-center rounded-xl bg-muted px-2",
        active && "bg-primary text-primary-foreground",
        className
      )}
    >
      {label}
    </button>
  )
}

/**
 * The note toolbar on a phone, like the iPhone Notes one: a slim bar docked above the keyboard (format,
 * checklist, picture, undo, redo), and an "Aa" panel above it with the few formats that matter (styles, bold,
 * italic, underline, strikethrough, lists, quote, link, colors). It stays while the note is being edited and
 * goes when a tap lands outside the note (see NoteEditor), never because a button was pressed. Everything else
 * (code block, divider, alignment) is on the desktop toolbar and in the "/" menu.
 */
export function PhoneToolbar({
  editor,
  panelOpen,
  onTogglePanel,
  onPickImage,
  keyboardOpen,
}: {
  editor: Editor
  panelOpen: boolean
  onTogglePanel: () => void
  onPickImage: () => void
  /** The keyboard covers the bottom of the screen: no room needed for the home indicator. */
  keyboardOpen: boolean
}) {
  const chain = () => editor.chain().focus()
  const heading = (level: 1 | 2 | 3) => editor.isActive("heading", { level })

  function setLink() {
    const previous = editor.getAttributes("link").href as string | undefined
    const href = window.prompt(
      "Link address (https://…). Leave empty to remove the link.",
      previous ?? "https://"
    )
    if (href === null) return
    if (href.trim() === "" || href.trim() === "https://") {
      chain().extendMarkRange("link").unsetLink().run()
    } else {
      chain().extendMarkRange("link").setLink({ href: href.trim() }).run()
    }
  }

  return (
    <div
      data-phone-toolbar
      style={{ paddingBottom: keyboardOpen ? 0 : "env(safe-area-inset-bottom)" }}
      className="fixed inset-x-0 bottom-(--kb) z-40 border-t bg-background/90 backdrop-blur sm:hidden"
    >
      {panelOpen && (
        <div className="max-h-[45dvh] space-y-2 overflow-y-auto overscroll-contain border-b p-3">
          <Row>
            <Pill
              label="Title"
              active={heading(1)}
              onClick={() => chain().setHeading({ level: 1 }).run()}
              className="text-lg font-bold"
            />
            <Pill
              label="Heading"
              active={heading(2)}
              onClick={() => chain().setHeading({ level: 2 }).run()}
              className="text-base font-semibold"
            />
            <Pill
              label="Body"
              active={editor.isActive("paragraph") && !editor.isActive("heading")}
              onClick={() => chain().setParagraph().run()}
              className="text-sm"
            />
          </Row>
          <Row>
            <Tool
              label="Bold"
              active={editor.isActive("bold")}
              onClick={() => chain().toggleBold().run()}
              className="w-full bg-muted"
            >
              <Bold />
            </Tool>
            <Tool
              label="Italic"
              active={editor.isActive("italic")}
              onClick={() => chain().toggleItalic().run()}
              className="w-full bg-muted"
            >
              <Italic />
            </Tool>
            <Tool
              label="Underline"
              active={editor.isActive("underline")}
              onClick={() => chain().toggleUnderline().run()}
              className="w-full bg-muted"
            >
              <Underline />
            </Tool>
            <Tool
              label="Strikethrough"
              active={editor.isActive("strike")}
              onClick={() => chain().toggleStrike().run()}
              className="w-full bg-muted"
            >
              <Strikethrough />
            </Tool>
          </Row>
          <Row>
            <Tool
              label="Bullet list"
              active={editor.isActive("bulletList")}
              onClick={() => chain().toggleBulletList().run()}
              className="w-full bg-muted"
            >
              <List />
            </Tool>
            <Tool
              label="Numbered list"
              active={editor.isActive("orderedList")}
              onClick={() => chain().toggleOrderedList().run()}
              className="w-full bg-muted"
            >
              <ListOrdered />
            </Tool>
            <Tool
              label="Quote"
              active={editor.isActive("blockquote")}
              onClick={() => chain().toggleBlockquote().run()}
              className="w-full bg-muted"
            >
              <Quote />
            </Tool>
            <Tool
              label="Link"
              active={editor.isActive("link")}
              onClick={setLink}
              className="w-full bg-muted"
            >
              <Link2 />
            </Tool>
          </Row>
          <div className="flex items-center gap-2 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <span className="shrink-0 text-xs text-muted-foreground">Color</span>
            {TEXT_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`Text color ${color}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => chain().setColor(color).run()}
                data-compact
                className="size-9 shrink-0 rounded-full border border-black/10"
                style={{ background: color }}
              />
            ))}
            <button
              type="button"
              aria-label="Text color: none"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => chain().unsetColor().run()}
              data-compact
              className="size-9 shrink-0 rounded-full border text-sm text-muted-foreground"
            >
              ×
            </button>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <span className="shrink-0 text-xs text-muted-foreground">Marker</span>
            {HIGHLIGHTS.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`Highlight ${color}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => chain().setHighlight({ color }).run()}
                data-compact
                className="size-9 shrink-0 rounded-full border border-black/10"
                style={{ background: color }}
              />
            ))}
            <button
              type="button"
              aria-label="Highlight: none"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => chain().unsetHighlight().run()}
              data-compact
              className="size-9 shrink-0 rounded-full border text-sm text-muted-foreground"
            >
              ×
            </button>
          </div>
        </div>
      )}
      <div className="grid grid-cols-5">
        <Tool label="Format" active={panelOpen} onClick={onTogglePanel} className="w-full">
          <Type />
        </Tool>
        <Tool
          label="Checklist"
          active={editor.isActive("taskList")}
          onClick={() => chain().toggleTaskList().run()}
          className="w-full"
        >
          <ListChecks />
        </Tool>
        <Tool label="Insert picture" onClick={onPickImage} className="w-full">
          <ImagePlus />
        </Tool>
        <Tool
          label="Undo"
          disabled={!editor.can().undo()}
          onClick={() => chain().undo().run()}
          className="w-full"
        >
          <Undo2 />
        </Tool>
        <Tool
          label="Redo"
          disabled={!editor.can().redo()}
          onClick={() => chain().redo().run()}
          className="w-full"
        >
          <Redo2 />
        </Tool>
      </div>
    </div>
  )
}
