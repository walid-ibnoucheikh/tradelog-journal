import { ChevronLeft, ChevronRight } from "lucide-react"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"

/** "Page 2 of 5 · 112 trades" with previous and next arrows, for a list cut by `?page=`. */
export function Pagination({
  page,
  pageCount,
  total,
  noun,
  hrefFor,
}: {
  page: number
  pageCount: number
  total: number
  /** What the rows are, in the plural ("trades", "days"). */
  noun: string
  hrefFor: (page: number) => string
}) {
  if (pageCount <= 1) return null
  return (
    <nav aria-label="Pagination" className="flex items-center justify-end gap-3 text-sm">
      <span className="text-muted-foreground">
        Page {page} of {pageCount} · {total} {noun}
      </span>
      {page > 1 ? (
        <Link
          href={hrefFor(page - 1)}
          aria-label="Previous page"
          className={buttonVariants({ variant: "outline", size: "icon" })}
        >
          <ChevronLeft />
        </Link>
      ) : null}
      {page < pageCount ? (
        <Link
          href={hrefFor(page + 1)}
          aria-label="Next page"
          className={buttonVariants({ variant: "outline", size: "icon" })}
        >
          <ChevronRight />
        </Link>
      ) : null}
    </nav>
  )
}
