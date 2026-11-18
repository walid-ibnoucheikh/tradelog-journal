"use client"

import { CircleCheck, FileSpreadsheet, UploadCloud, X } from "lucide-react"
import { useRef, useState } from "react"
import { formatFileSize } from "@/lib/format"
import { cn } from "@/lib/utils"

/**
 * A drop zone for one CSV file. The real file input is kept (hidden) so the browser sends the file
 * with the form; dropping a file puts it in that input.
 */
export function FileDrop({
  name,
  title,
  description,
  badge,
  file,
  onChange,
}: {
  name: string
  title: string
  description: string
  badge: string
  file: File | null
  onChange: (file: File | null) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  function clear() {
    if (input.current) input.current.value = ""
    onChange(null)
  }

  function accept(files: FileList | null) {
    const chosen = files?.[0] ?? null
    if (chosen && !/\.csv$/i.test(chosen.name)) {
      setProblem(`“${chosen.name}” is not a .csv file.`)
      clear()
      return
    }
    setProblem(null)
    onChange(chosen)
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <label
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault()
            setDragging(false)
            if (input.current && event.dataTransfer.files.length > 0) {
              input.current.files = event.dataTransfer.files
              accept(input.current.files)
            }
          }}
          className={cn(
            "flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-5 text-center transition-colors hover:border-primary/60 hover:bg-muted/40 has-[:focus-visible]:border-primary has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
            dragging && "border-primary bg-primary/5",
            file && "border-solid border-profit/50 bg-profit/5 hover:border-profit/50"
          )}
        >
          <input
            ref={input}
            type="file"
            name={name}
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(event) => accept(event.target.files)}
          />
          {file ? (
            <>
              <CircleCheck className="size-7 text-profit-text" />
              <div className="max-w-full">
                <p className="truncate font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
              </div>
            </>
          ) : (
            <>
              <div className="flex size-11 items-center justify-center rounded-full bg-muted">
                {dragging ? (
                  <UploadCloud className="size-5 text-primary" />
                ) : (
                  <FileSpreadsheet className="size-5 text-muted-foreground" />
                )}
              </div>
              <div>
                <p className="font-medium">{title}</p>
                <p className="text-xs text-muted-foreground">{description}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Drop the file here or <span className="font-medium text-primary">browse</span>
              </p>
            </>
          )}
        </label>
        <span className="absolute top-3 left-3 rounded bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {badge}
        </span>
        {file && (
          <button
            type="button"
            onClick={clear}
            aria-label={`Remove ${file.name}`}
            className="absolute top-2 right-2 inline-flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
      {problem && (
        <p role="alert" className="text-xs text-destructive">
          {problem}
        </p>
      )}
    </div>
  )
}
