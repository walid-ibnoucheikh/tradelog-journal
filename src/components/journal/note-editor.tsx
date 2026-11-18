"use client"

import { Popover } from "@base-ui/react/popover"
import { TaskItem, TaskList } from "@tiptap/extension-list"
import Highlight from "@tiptap/extension-highlight"
import Image from "@tiptap/extension-image"
import TextAlign from "@tiptap/extension-text-align"
import { Color, TextStyle } from "@tiptap/extension-text-style"
import { Placeholder } from "@tiptap/extensions"
import { EditorContent, useEditor, type Editor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Code2,
  Highlighter,
  ImagePlus,
  Italic,
  Link2,
  Maximize2,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Palette,
  Quote,
  Redo2,
  Strikethrough,
  Underline,
  Undo2,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { noteText, type NoteNode } from "@/lib/note"
import { cn } from "@/lib/utils"
import { imageFiles, imagesOfTransfer, uploadNoteImage } from "./note-image-upload"
import { ImageLightbox } from "./image-lightbox"
import { PhoneToolbar } from "./phone-toolbar"
import { SlashMenu, filterSlash } from "./slash-menu"
import { HIGHLIGHTS, TEXT_COLORS } from "./toolbar-colors"

/**
 * How much of the screen the on-screen keyboard covers, in px (0 without one). iOS Safari does not resize
 * the page when the keyboard opens, so a bar docked at the bottom has to be lifted by this amount.
 */
function useKeyboardInset() {
  const [inset, setInset] = useState(0)
  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    const update = () =>
      setInset(Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop)))
    update()
    viewport.addEventListener("resize", update)
    viewport.addEventListener("scroll", update)
    return () => {
      viewport.removeEventListener("resize", update)
      viewport.removeEventListener("scroll", update)
    }
  }, [])
  return inset
}

/** The picture of a note: resizable by dragging a corner, and aligned left, centered or right. */
const NotePicture = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      align: {
        default: "left",
        parseHTML: (element) => element.getAttribute("data-align") ?? "left",
        renderHTML: (attributes) =>
          attributes.align && attributes.align !== "left" ? { "data-align": attributes.align } : {},
      },
    }
  },
})

/** Quick sizes for the selected picture, as a share of the page width ("original" keeps its own pixels). */
const SIZES = [
  { label: "S", title: "small (25%)", fraction: 0.25 },
  { label: "M", title: "medium (50%)", fraction: 0.5 },
  { label: "L", title: "large (75%)", fraction: 0.75 },
  { label: "Full", title: "full width", fraction: 1 },
  { label: "1:1", title: "original size", fraction: "original" },
] as const

/** Sets the selected picture to a share of the page width (never above its own pixels), keeping its ratio. */
function resizePicture(editor: Editor, fraction: number | "original") {
  const dom = editor.view.nodeDOM(editor.state.selection.from)
  const img =
    dom instanceof HTMLImageElement
      ? dom
      : dom instanceof HTMLElement
        ? dom.querySelector("img")
        : null
  if (!img || !img.naturalWidth) return
  const page = editor.view.dom.clientWidth
  const wanted = fraction === "original" ? img.naturalWidth : Math.round(page * fraction)
  const width = Math.max(40, Math.min(wanted, img.naturalWidth))
  const height = Math.round((width * img.naturalHeight) / img.naturalWidth)
  editor.chain().focus().updateAttributes("image", { width, height }).run()
}

function ToolbarButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      // Keep the focus (and the selection) in the editor when the button is pressed.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded hover:bg-muted disabled:opacity-40 [&_svg]:size-4",
        active && "bg-muted text-primary"
      )}
    >
      {children}
    </button>
  )
}

const Separator = () => <span className="mx-1 h-5 w-px bg-border" />

/** A button that opens a small palette of colors (text color or highlight), with a "none" swatch. */
function ColorButton({
  label,
  colors,
  active,
  onPick,
  children,
}: {
  label: string
  colors: string[]
  active: boolean
  onPick: (color: string | null) => void
  children: React.ReactNode
}) {
  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label={label}
        title={label}
        onMouseDown={(event) => event.preventDefault()}
        className={cn(
          "inline-flex size-8 items-center justify-center rounded hover:bg-muted [&_svg]:size-4",
          active && "bg-muted text-primary"
        )}
      >
        {children}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={6} className="z-[60]">
          <Popover.Popup
            // On a phone the focus stays in the note: the keyboard and the docked toolbar must not close.
            initialFocus={(type) => type !== "touch"}
            className="flex flex-wrap gap-1.5 rounded-lg border bg-popover p-2 shadow-lg outline-none"
          >
            {colors.map((color) => (
              <Popover.Close
                key={color}
                aria-label={`${label} ${color}`}
                onClick={() => onPick(color)}
                className="size-6 rounded-full border border-black/10"
                style={{ background: color }}
              />
            ))}
            <Popover.Close
              aria-label={`${label}: none`}
              title="None"
              onClick={() => onPick(null)}
              className="size-6 rounded-full border text-xs text-muted-foreground"
            >
              ×
            </Popover.Close>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}

function Toolbar({
  editor,
  onPickImage,
  onEnlarge,
}: {
  editor: Editor
  onPickImage: () => void
  onEnlarge: () => void
}) {
  const chain = () => editor.chain().focus()
  const level = [1, 2, 3].find((value) => editor.isActive("heading", { level: value }))
  // With a picture selected the buttons align the picture; otherwise the paragraph or heading.
  const pictureSelected = editor.isActive("image")
  const isAligned = (side: "left" | "center" | "right") =>
    pictureSelected
      ? (editor.getAttributes("image").align ?? "left") === side
      : editor.isActive({ textAlign: side })
  const align = (side: "left" | "center" | "right") =>
    pictureSelected
      ? chain().updateAttributes("image", { align: side }).run()
      : chain().setTextAlign(side).run()

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
    <div className="flex flex-wrap items-center gap-0.5 border-b p-1.5">
      <ToolbarButton
        label="Undo"
        disabled={!editor.can().undo()}
        onClick={() => chain().undo().run()}
      >
        <Undo2 />
      </ToolbarButton>
      <ToolbarButton
        label="Redo"
        disabled={!editor.can().redo()}
        onClick={() => chain().redo().run()}
      >
        <Redo2 />
      </ToolbarButton>
      <Separator />
      <select
        aria-label="Text style"
        value={level ?? 0}
        onChange={(event) => {
          const value = Number(event.target.value)
          if (value === 0) chain().setParagraph().run()
          else
            chain()
              .setHeading({ level: value as 1 | 2 | 3 })
              .run()
        }}
        className="h-8 rounded border bg-transparent px-1.5 text-sm"
      >
        <option value={0}>Text</option>
        <option value={1}>Heading 1</option>
        <option value={2}>Heading 2</option>
        <option value={3}>Heading 3</option>
      </select>
      <Separator />
      <ToolbarButton
        label="Bold"
        active={editor.isActive("bold")}
        onClick={() => chain().toggleBold().run()}
      >
        <Bold />
      </ToolbarButton>
      <ToolbarButton
        label="Italic"
        active={editor.isActive("italic")}
        onClick={() => chain().toggleItalic().run()}
      >
        <Italic />
      </ToolbarButton>
      <ToolbarButton
        label="Underline"
        active={editor.isActive("underline")}
        onClick={() => chain().toggleUnderline().run()}
      >
        <Underline />
      </ToolbarButton>
      <ToolbarButton
        label="Strikethrough"
        active={editor.isActive("strike")}
        onClick={() => chain().toggleStrike().run()}
      >
        <Strikethrough />
      </ToolbarButton>
      <ColorButton
        label="Text color"
        colors={TEXT_COLORS}
        active={!!editor.getAttributes("textStyle").color}
        onPick={(color) => (color ? chain().setColor(color).run() : chain().unsetColor().run())}
      >
        <Palette />
      </ColorButton>
      <ColorButton
        label="Highlight"
        colors={HIGHLIGHTS}
        active={editor.isActive("highlight")}
        onPick={(color) =>
          color ? chain().setHighlight({ color }).run() : chain().unsetHighlight().run()
        }
      >
        <Highlighter />
      </ColorButton>
      <Separator />
      <ToolbarButton label="Align left" active={isAligned("left")} onClick={() => align("left")}>
        <AlignLeft />
      </ToolbarButton>
      <ToolbarButton
        label="Align center"
        active={isAligned("center")}
        onClick={() => align("center")}
      >
        <AlignCenter />
      </ToolbarButton>
      <ToolbarButton label="Align right" active={isAligned("right")} onClick={() => align("right")}>
        <AlignRight />
      </ToolbarButton>
      <Separator />
      <ToolbarButton
        label="Bullet list"
        active={editor.isActive("bulletList")}
        onClick={() => chain().toggleBulletList().run()}
      >
        <List />
      </ToolbarButton>
      <ToolbarButton
        label="Numbered list"
        active={editor.isActive("orderedList")}
        onClick={() => chain().toggleOrderedList().run()}
      >
        <ListOrdered />
      </ToolbarButton>
      <ToolbarButton
        label="Task list"
        active={editor.isActive("taskList")}
        onClick={() => chain().toggleTaskList().run()}
      >
        <ListChecks />
      </ToolbarButton>
      <Separator />
      <ToolbarButton
        label="Quote"
        active={editor.isActive("blockquote")}
        onClick={() => chain().toggleBlockquote().run()}
      >
        <Quote />
      </ToolbarButton>
      <ToolbarButton
        label="Code block"
        active={editor.isActive("codeBlock")}
        onClick={() => chain().toggleCodeBlock().run()}
      >
        <Code2 />
      </ToolbarButton>
      <ToolbarButton label="Divider" onClick={() => chain().setHorizontalRule().run()}>
        <Minus />
      </ToolbarButton>
      <ToolbarButton label="Link" active={editor.isActive("link")} onClick={setLink}>
        <Link2 />
      </ToolbarButton>
      <ToolbarButton label="Insert picture" onClick={onPickImage}>
        <ImagePlus />
      </ToolbarButton>
      {pictureSelected && (
        <>
          <Separator />
          {SIZES.map((size) => (
            <button
              key={size.label}
              type="button"
              title={`Picture size: ${size.title}`}
              aria-label={`Picture size: ${size.title}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => resizePicture(editor, size.fraction)}
              className="inline-flex h-8 min-w-8 items-center justify-center rounded px-1.5 text-xs font-medium hover:bg-muted"
            >
              {size.label}
            </button>
          ))}
          <ToolbarButton label="Enlarge picture" onClick={onEnlarge}>
            <Maximize2 />
          </ToolbarButton>
        </>
      )}
    </div>
  )
}

/**
 * Rich text editor for a note: headings, colors, alignment, lists, code, links and pictures (pasted,
 * dropped, picked or resized by dragging a corner), and a "/" menu to insert blocks. Reports the document as
 * JSON text and the length of its plain text.
 */
export function NoteEditor({
  initial,
  label,
  maxLength,
  onChange,
  tall = false,
  document: asDocument = false,
}: {
  initial: NoteNode
  label: string
  maxLength: number
  onChange: (json: string, length: number) => void
  /** Fills the height of its container (the notebook) instead of staying a small box (a window). */
  tall?: boolean
  /** Page look for the notebook: no frame, a centered reading column and a toolbar that stays on top. */
  document?: boolean
}) {
  const [status, setStatus] = useState<{ busy: boolean; error: string | null }>({
    busy: false,
    error: null,
  })
  const [slash, setSlash] = useState<{
    from: number
    to: number
    query: string
    left: number
    top: number
  } | null>(null)
  const [slashIndex, setSlashIndex] = useState(0)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const editorRef = useRef<Editor | null>(null)
  const picker = useRef<HTMLInputElement>(null)
  const root = useRef<HTMLDivElement>(null)
  // A phone shows its toolbar while the note is being edited: from the first touch of the text until "Done" or
  // a tap outside the note. Pressing a toolbar button never ends it (the focus may move, the bar stays).
  const [editing, setEditing] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  // The keyboard handler is created once; it reads the menu through this ref.
  const menu = useRef<{ open: boolean; count: number; index: number }>({
    open: false,
    count: 0,
    index: 0,
  })
  const pick = useRef<(index: number) => void>(() => {})

  async function insertImages(files: File[]) {
    const editor = editorRef.current
    if (!editor || files.length === 0) return
    setStatus({ busy: true, error: null })
    try {
      for (const file of files) {
        const src = await uploadNoteImage(file)
        editor.chain().focus().setImage({ src }).run()
      }
      setStatus({ busy: false, error: null })
    } catch (error) {
      console.error("Picture upload failed", error)
      setStatus({ busy: false, error: error instanceof Error ? error.message : "Upload failed." })
    }
  }

  /** Opens the "/" menu when the line holds only a slash and what follows it. */
  function refreshSlash(editor: Editor) {
    const { selection } = editor.state
    const { $from } = selection
    if (!selection.empty || $from.parent.type.name !== "paragraph") return setSlash(null)
    const before = $from.parent.textBetween(0, $from.parentOffset, undefined, "\ufffc")
    const match = /^\/([A-Za-z0-9 ]{0,24})$/.exec(before)
    if (!match) return setSlash(null)
    const at = editor.view.coordsAtPos($from.pos)
    const query = match[1].toLowerCase()
    setSlash((previous) => {
      if (previous?.query !== query) setSlashIndex(0)
      return {
        from: $from.pos - before.length,
        to: $from.pos,
        query,
        left: at.left,
        top: at.bottom,
      }
    })
  }

  const editor = useEditor({
    extensions: [
      // Only what the toolbar offers: the server refuses any other node or mark (`cleanNote`).
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        code: false,
        link: {
          openOnClick: false,
          HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" },
        },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      // Dragging a corner of a picture resizes it (the size is kept in the note).
      NotePicture.configure({
        allowBase64: false,
        resize: {
          enabled: true,
          directions: ["bottom-right", "bottom-left"],
          minWidth: 80,
          minHeight: 40,
          alwaysPreserveAspectRatio: true,
        },
      }),
      Placeholder.configure({
        placeholder: ({ node }) =>
          node.type.name === "heading" ? "Heading" : "Write something, or press / for blocks",
      }),
    ],
    content: initial,
    // Server rendering has no DOM to build the editor in.
    immediatelyRender: false,
    // The toolbar shows the state of the selection, so it must follow every transaction.
    shouldRerenderOnTransaction: true,
    editorProps: {
      attributes: { class: "note-editor", "aria-label": label },
      // Keep the line being typed clear of the docked toolbar on a phone.
      scrollMargin: {
        top: 8,
        left: 8,
        right: 8,
        bottom: typeof window !== "undefined" && matchMedia("(max-width: 639px)").matches ? 120 : 8,
      },
      handlePaste: (_view, event) => {
        const files = imagesOfTransfer(event.clipboardData)
        if (files.length === 0) return false
        void insertImages(files)
        return true
      },
      handleDrop: (_view, event) => {
        const files = imagesOfTransfer(event.dataTransfer)
        if (files.length === 0) return false
        void insertImages(files)
        return true
      },
      // A double click on a picture shows it big (a chart screenshot is easier to read that way).
      handleDoubleClickOn: (_view, _pos, node) => {
        if (node.type.name !== "image") return false
        setLightbox(node.attrs.src as string)
        return true
      },
      handleKeyDown: (_view, event) => {
        const state = menu.current
        if (!state.open || state.count === 0) return false
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          const step = event.key === "ArrowDown" ? 1 : -1
          setSlashIndex((state.index + step + state.count) % state.count)
          return true
        }
        if (event.key === "Enter" || event.key === "Tab") {
          pick.current(state.index)
          return true
        }
        if (event.key === "Escape") {
          setSlash(null)
          return true
        }
        return false
      },
    },
    onCreate: ({ editor }) => {
      editorRef.current = editor
    },
    onFocus: () => setEditing(true),
    onSelectionUpdate: ({ editor }) => refreshSlash(editor),
    onUpdate: ({ editor }) => {
      const doc = editor.getJSON() as NoteNode
      onChange(JSON.stringify(doc), noteText(doc).trim().length)
      refreshSlash(editor)
    },
  })

  const slashItems = slash ? filterSlash(slash.query) : []
  useEffect(() => {
    menu.current = { open: slash !== null, count: slashItems.length, index: slashIndex }
    pick.current = (index) => {
      const item = slashItems[index]
      if (!editor || !slash || !item) return
      editor.chain().focus().deleteRange({ from: slash.from, to: slash.to }).run()
      item.run(editor, { pickImage: () => picker.current?.click() })
      setSlash(null)
    }
  })

  const length = editor ? noteText(editor.getJSON() as NoteNode).trim().length : 0
  const keyboard = useKeyboardInset()

  /**
   * The Aa panel takes the place of the keyboard, like Apple Notes: while it is open the note keeps its focus
   * but asks for no keyboard (`inputmode="none"`); closing the panel brings the keyboard back.
   */
  function showPanel(open: boolean) {
    setPanelOpen(open)
    const dom = editorRef.current?.view.dom
    if (!dom) return
    dom.setAttribute("inputmode", open ? "none" : "text")
    // iOS reads inputmode when the field takes the focus: let go of it, then take it again.
    editorRef.current?.commands.blur()
    setTimeout(() => editorRef.current?.commands.focus(), 60)
  }

  useEffect(() => {
    if (!editing) return
    function outside(event: PointerEvent) {
      if (!(event.target instanceof Node) || root.current?.contains(event.target)) return
      setEditing(false)
      setPanelOpen(false)
      editorRef.current?.view.dom.setAttribute("inputmode", "text")
      // iOS keeps the keyboard up when a blank area is tapped: let it go. A button (Save note, say) takes its
      // tap first: the layout moves when the keyboard leaves, and the tap could miss it.
      const interactive =
        event.target instanceof Element &&
        event.target.closest("button, a, input, select, textarea, summary, [role='button']")
      window.setTimeout(() => editorRef.current?.commands.blur(), interactive ? 350 : 0)
    }
    document.addEventListener("pointerdown", outside, true)
    return () => document.removeEventListener("pointerdown", outside, true)
  }, [editing])

  return (
    <div
      ref={root}
      style={{ "--kb": `${keyboard}px` } as React.CSSProperties}
      className={cn(
        "flex flex-col bg-background",
        // The Aa panel covers the bottom of the screen: leave room so the note can still scroll above it.
        panelOpen && !asDocument && "max-sm:pb-[24rem]",
        asDocument ? "h-full min-h-0" : "overflow-hidden rounded-lg border",
        tall && !asDocument && "h-full"
      )}
    >
      {editor && (
        <div
          className={cn(
            // On a phone every note uses the PhoneToolbar (below) instead of this one.
            "max-sm:hidden",
            asDocument && "sticky top-0 z-10 border-b bg-background/95 backdrop-blur"
          )}
        >
          <Toolbar
            editor={editor}
            onPickImage={() => picker.current?.click()}
            onEnlarge={() => {
              const src = editor.getAttributes("image").src as string | undefined
              if (src) setLightbox(src)
            }}
          />
        </div>
      )}
      {editor && editing && (
        <PhoneToolbar
          editor={editor}
          panelOpen={panelOpen}
          keyboardOpen={keyboard > 80}
          onTogglePanel={() => showPanel(!panelOpen)}
          onPickImage={() => picker.current?.click()}
        />
      )}
      <input
        ref={picker}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        multiple
        className="hidden"
        onChange={(event) => {
          void insertImages(imageFiles(event.target.files))
          event.target.value = ""
        }}
      />
      <div
        className={cn(
          "overflow-y-auto",
          asDocument
            ? cn("min-h-0 flex-1", panelOpen ? "max-sm:pb-[26rem]" : "max-sm:pb-16")
            : tall
              ? "min-h-0 flex-1"
              : "max-h-80 min-h-48"
        )}
      >
        <div className={cn(asDocument && "mx-auto w-full max-w-3xl px-2 py-4 sm:px-8")}>
          <EditorContent editor={editor} />
        </div>
      </div>
      <ImageLightbox src={lightbox} onClose={() => setLightbox(null)} />
      {slash && slashItems.length > 0 && (
        <SlashMenu
          items={slashItems}
          index={slashIndex}
          left={slash.left}
          top={slash.top}
          onPick={(item) => pick.current(slashItems.indexOf(item))}
          onHover={setSlashIndex}
        />
      )}
      <div
        className={cn(
          "flex items-center justify-between gap-3 px-3 py-1.5 text-xs text-muted-foreground",
          !asDocument && "border-t"
        )}
      >
        <span role="status" className={cn(status.error && "text-destructive")}>
          {status.busy ? "Saving picture…" : status.error}
        </span>
        <span className={cn(length > maxLength && "text-destructive")}>
          {length.toLocaleString("en-US")} / {maxLength.toLocaleString("en-US")} characters
        </span>
      </div>
    </div>
  )
}
