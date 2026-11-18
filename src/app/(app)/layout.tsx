import { cookies } from "next/headers"
import { Suspense } from "react"
import { MobileNav } from "@/components/mobile-nav"
import { TouchFeel } from "@/components/touch-feel"
import { Sidebar } from "@/components/sidebar"
import { SIDEBAR_COOKIE } from "@/lib/sidebar"

/** Reads the menu state from its cookie, so a collapsed menu is already collapsed on first paint. */
async function SidebarWithState() {
  const collapsed = (await cookies()).get(SIDEBAR_COOKIE)?.value === "collapsed"
  return <Sidebar initialCollapsed={collapsed} />
}

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <TouchFeel />
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:rounded-lg focus:bg-card focus:px-3 focus:py-2 focus:text-sm focus:shadow-lg"
      >
        Skip to content
      </a>
      {/* usePathname and the cookie are only known per request on dynamic routes such as /trades/[id]. */}
      <Suspense fallback={<aside className="hidden w-56 shrink-0 bg-sidebar lg:block" />}>
        <SidebarWithState />
      </Suspense>
      <div className="flex min-w-0 flex-1 flex-col">
        <Suspense
          fallback={
            <div className="h-[calc(3.5rem+env(safe-area-inset-top))] bg-sidebar lg:hidden" />
          }
        >
          <MobileNav />
        </Suspense>
        <main
          id="contenu"
          tabIndex={-1}
          className="min-w-0 flex-1 px-4 py-4 pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] outline-none sm:px-6 lg:px-8 lg:py-6"
        >
          {children}
        </main>
      </div>
    </>
  )
}
