"use client"

import { FileStack, UploadCloud } from "lucide-react"
import { useRef, useState } from "react"
import { detectTradovateFile, type TradovateFileKind } from "@/lib/trading/tradovate/detect"
import { cn } from "@/lib/utils"

/**
 * One drop zone for both Tradovate files at once. Each file is sorted by what is inside it (the header line),
 * not by its name, so `Fills.csv` and `Cash History.csv` can be dropped together, in any order.
 */
export function TradovateDrop({
  onFiles,
}: {
  onFiles: (files: Partial<Record<TradovateFileKind, File>>) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  async function sort(list: FileList | null) {
    const files = [...(list ?? [])]
    if (files.length === 0) return
    const found: Partial<Record<TradovateFileKind, File>> = {}
    const unknown: string[] = []
    for (const file of files) {
      const kind = /\.csv$/i.test(file.name)
        ? detectTradovateFile(await file.slice(0, 4096).text())
        : null
      if (kind) found[kind] = file
      else unknown.push(file.name)
    }
    setProblem(
      unknown.length > 0
        ? `${unknown.map((name) => `“${name}”`).join(", ")} ${unknown.length > 1 ? "are" : "is"} not a Tradovate Fills or Cash History export.`
        : null
    )
    if (found.fills || found.cash) onFiles(found)
    if (input.current) input.current.value = ""
  }

  return (
    <div className="space-y-2">
      <label
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          void sort(event.dataTransfer.files)
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors hover:border-primary/60 hover:bg-muted/40 has-[:focus-visible]:border-primary has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
          dragging && "border-primary bg-primary/5"
        )}
      >
        <input
          ref={input}
          type="file"
          accept=".csv,text/csv"
          multiple
          className="sr-only"
          onChange={(event) => void sort(event.target.files)}
        />
        <div className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
          {dragging ? <UploadCloud className="size-5" /> : <FileStack className="size-5" />}
        </div>
        <p className="font-medium">Drop both Tradovate files here</p>
        <p className="text-sm text-muted-foreground">
          Fills and Cash History, together and in any order: each one is recognised by its content.{" "}
          <span className="font-medium text-primary">Browse</span>
        </p>
      </label>
      {problem && (
        <p role="alert" className="text-xs text-destructive">
          {problem}
        </p>
      )}
    </div>
  )
}
