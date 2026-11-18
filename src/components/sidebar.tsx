"use client"

import {
  BookOpen,
  ChartCandlestick,
  ChartColumn,
  ChevronsLeft,
  LayoutDashboard,
  LogOut,
  NotebookText,
  PiggyBank,
  Plus,
  Upload,
  Wallet,
} from "lucide-react"
import Link, { useLinkStatus } from "next/link"
import { usePathname } from "next/navigation"
import { useState, useSyncExternalStore } from "react"
import { logout } from "@/app/login/actions"
import { LogoMark } from "@/components/logo"
import { readAccount, subscribeAccount, withAccount } from "@/lib/account-memory"
import { ThemeToggle } from "@/components/theme-toggle"
import { SIDEBAR_COOKIE } from "@/lib/sidebar"
import { cn } from "@/lib/utils"

const links = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/journal", label: "Daily Journal", icon: BookOpen },
  { href: "/trades", label: "Trades", icon: ChartCandlestick },
  { href: "/notebook", label: "Notebook", icon: NotebookText },
  { href: "/reports", label: "Reports", icon: ChartColumn },
  { href: "/investments", label: "Investments", icon: PiggyBank },
  { href: "/accounts", label: "Accounts", icon: Wallet },
  { href: "/import", label: "Import", icon: Upload },
]

/** Small pulsing dot on a menu link while its page is loading. */
function PendingDot() {
  const { pending } = useLinkStatus()
  return pending ? (
    <span aria-hidden className="ml-auto size-1.5 animate-pulse rounded-full bg-current" />
  ) : null
}

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"

/**
 * Logo, add button, navigation, theme switch and logout: shared by the desktop sidebar and the phone drawer.
 * `onToggleCollapse` shows the shrink button (desktop only); `onNavigate` lets the drawer close itself.
 */
export function SidebarContent({
  collapsed = false,
  onToggleCollapse,
  onNavigate,
}: {
  collapsed?: boolean
  onToggleCollapse?: () => void
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  // The account chosen in a page filter follows you to the other filtered pages.
  const account = useSyncExternalStore(subscribeAccount, readAccount, () => null)

  // Labels slide shut instead of vanishing, and stay in the page for screen readers when only icons show.
  const slide =
    "overflow-hidden whitespace-nowrap transition-[max-width,opacity,margin] duration-300 ease-in-out"
  const label = cn(slide, collapsed ? "ml-0 max-w-0 opacity-0" : "ml-3 max-w-44 opacity-100")
  const addLabel = cn(slide, collapsed ? "ml-0 max-w-0 opacity-0" : "ml-2 max-w-44 opacity-100")
  // The icon sits at the same place open or shut (same padding), so it does not jump while the bar slides.
  const row = "flex h-11 items-center rounded-lg px-3 lg:h-9"

  return (
    <>
      <div className="flex h-9 items-center">
        {collapsed && onToggleCollapse ? (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label="Show the sidebar"
            title="Show the sidebar"
            className={cn("ml-1.5 rounded-lg transition-transform hover:scale-105", focusRing)}
          >
            <LogoMark className="size-7" />
          </button>
        ) : (
          <Link
            href="/"
            onClick={onNavigate}
            aria-label="Tradelog, home"
            className={cn("ml-1.5 flex items-center gap-2.5 rounded-lg", focusRing)}
          >
            <LogoMark className="size-7 shrink-0" />
            <span className="text-lg font-semibold tracking-[0.2em] text-sidebar-accent-foreground">
              TRADELOG
            </span>
          </Link>
        )}
        {!collapsed && onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label="Hide the sidebar"
            title="Hide the sidebar"
            className={cn(
              "ml-auto inline-flex size-8 items-center justify-center rounded-lg transition-colors hover:bg-sidebar-accent/60",
              focusRing
            )}
          >
            <ChevronsLeft className="size-4" />
          </button>
        )}
      </div>
      <Link
        href="/import"
        title="Add trades"
        onClick={onNavigate}
        className={cn(
          "flex h-10 items-center justify-center rounded-lg bg-sidebar-primary text-sm font-medium text-sidebar-primary-foreground transition-opacity hover:opacity-90",
          focusRing
        )}
      >
        <Plus className="size-4" />
        <span className={addLabel}>Add trades</span>
      </Link>
      <nav aria-label="Main navigation" className="flex flex-col gap-1">
        {links.map(({ href, label: text, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={withAccount(href, account)}
              // Prefetch the page itself (its cached content), not only its shell: the click then
              // shows it at once instead of a loading state.
              prefetch
              title={text}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                row,
                "text-sm transition-colors hover:bg-sidebar-accent/60",
                focusRing,
                active && "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span className={label}>{text}</span>
              {!collapsed && <PendingDot />}
            </Link>
          )
        })}
      </nav>
      <div
        className={cn("mt-auto flex gap-1", collapsed ? "flex-col items-center" : "items-center")}
      >
        <form action={logout} className={cn("min-w-0", collapsed ? "w-full" : "flex-1")}>
          <button
            type="submit"
            title="Log out"
            className={cn(
              row,
              "w-full text-sm transition-colors hover:bg-sidebar-accent/60",
              focusRing
            )}
          >
            <LogOut className="size-4 shrink-0" />
            <span className={label}>Log out</span>
          </button>
        </form>
        <ThemeToggle />
      </div>
    </>
  )
}

/**
 * Left menu on large screens (below 1024 px the menu lives in `MobileNav`). It can shrink to its icons;
 * the choice is kept in a cookie so the server renders it right.
 */
export function Sidebar({ initialCollapsed = false }: { initialCollapsed?: boolean }) {
  const [collapsed, setCollapsed] = useState(initialCollapsed)

  function toggle() {
    const next = !collapsed
    setCollapsed(next)
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "open"}; path=/; max-age=31536000; samesite=lax`
  }

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 flex-col gap-6 bg-gradient-to-b from-sidebar to-sidebar-to px-3 py-5 text-sidebar-foreground overflow-x-hidden transition-[width] duration-300 ease-in-out lg:flex",
        collapsed ? "w-16" : "w-56"
      )}
    >
      <SidebarContent collapsed={collapsed} onToggleCollapse={toggle} />
    </aside>
  )
}
