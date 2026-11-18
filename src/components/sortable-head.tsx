"use client"

import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react"
import { useState } from "react"
import { TableHead } from "@/components/ui/table"
import type { SortDirection } from "@/lib/sort"
import { cn } from "@/lib/utils"

export interface SortState<K extends string> {
  key: K
  direction: SortDirection
}

/** Sort state of a table: a click on a column sorts by it, a second click reverses the order. */
export function useSort<K extends string>(
  initial: SortState<K>,
  /** Direction a column starts in when first clicked; "desc" for the others. */
  firstDirection: Partial<Record<K, SortDirection>> = {}
) {
  const [sort, setSort] = useState(initial)
  const toggle = (key: K) =>
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key, direction: firstDirection[key] ?? "desc" }
    )
  return { sort, toggle }
}

/** Header cell that sorts its column when clicked. */
export function SortHead<K extends string>({
  label,
  column,
  sort,
  onSort,
  align = "left",
  className,
}: {
  label: string
  column: K
  sort: SortState<K>
  onSort: (column: K) => void
  align?: "left" | "right"
  className?: string
}) {
  const active = sort.key === column
  const Icon = !active ? ChevronsUpDown : sort.direction === "asc" ? ArrowUp : ArrowDown
  return (
    <TableHead
      aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
      className={cn(align === "right" && "text-right", className)}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className={cn(
          "inline-flex min-h-8 items-center gap-1 rounded px-1 hover:bg-muted",
          align === "right" && "flex-row-reverse"
        )}
      >
        {label}
        <Icon className={cn("size-3.5", !active && "text-muted-foreground/60")} />
      </button>
    </TableHead>
  )
}
