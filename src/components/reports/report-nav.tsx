"use client"

import {
  CalendarDays,
  CalendarRange,
  CandlestickChart,
  ChartNoAxesColumn,
  Clock,
  LayoutGrid,
  Timer,
} from "lucide-react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"

const sections = [
  { items: [{ href: "/reports", label: "Overview", icon: LayoutGrid }] },
  {
    title: "Date",
    items: [
      { href: "/reports/day", label: "Day", icon: CalendarDays },
      { href: "/reports/week", label: "Week", icon: CalendarRange },
      { href: "/reports/month", label: "Month", icon: ChartNoAxesColumn },
      { href: "/reports/time", label: "Opening time", icon: Clock },
      { href: "/reports/duration", label: "Trade duration", icon: Timer },
    ],
  },
  {
    title: "Price and quantity",
    items: [{ href: "/reports/instrument", label: "Instrument", icon: CandlestickChart }],
  },
]

/** Menu of the report pages, in a card with a separator per group; keeps the account, period and P&L choices. */
export function ReportNav() {
  const pathname = usePathname()
  const params = useSearchParams()
  const query = params.toString()

  return (
    <nav
      aria-label="Reports"
      className="flex flex-row gap-2 overflow-x-auto rounded-xl border bg-card p-2 [-ms-overflow-style:none] [scrollbar-width:none] [mask-image:linear-gradient(to_right,black_calc(100%-2rem),transparent)] md:[mask-image:none] [&::-webkit-scrollbar]:hidden md:sticky md:top-6 md:flex-col md:gap-0 md:self-start md:overflow-visible"
    >
      {sections.map((section, index) => (
        <div
          key={index}
          className={cn(
            "flex flex-row gap-1 md:flex-col md:gap-0.5",
            index > 0 && "md:mt-2 md:border-t md:pt-2"
          )}
        >
          {section.title && (
            <p className="hidden px-3 pt-1 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase md:block">
              {section.title}
            </p>
          )}
          {section.items.map(({ href, label, icon: Icon }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={query ? `${href}?${query}` : href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-9 items-center gap-2.5 rounded-lg px-3 text-sm whitespace-nowrap transition-colors hover:bg-muted",
                  active
                    ? "bg-primary/10 font-medium text-primary before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-primary"
                    : "text-foreground/80"
                )}
              >
                <Icon className="size-4 shrink-0" />
                {label}
              </Link>
            )
          })}
        </div>
      ))}
    </nav>
  )
}
