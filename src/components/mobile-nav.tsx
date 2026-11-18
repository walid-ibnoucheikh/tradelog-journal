"use client"

import { Dialog } from "@base-ui/react/dialog"
import { Menu, X } from "lucide-react"
import { useState } from "react"
import { LogoMark } from "@/components/logo"
import { SidebarContent } from "@/components/sidebar"

const gradient = "bg-gradient-to-b from-sidebar to-sidebar-to text-sidebar-foreground"
const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"

/** Top bar with a menu button and a slide-in drawer, shown below 1024 px only. */
export function MobileNav() {
  const [open, setOpen] = useState(false)

  return (
    <header
      className={`sticky top-0 z-30 flex h-[calc(3.5rem+env(safe-area-inset-top))] items-center gap-3 pt-[env(safe-area-inset-top)] pr-[max(1rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))] lg:hidden ${gradient}`}
    >
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Trigger
          aria-label="Open the menu"
          className={`inline-flex size-11 items-center justify-center rounded-lg hover:bg-sidebar-accent/60 ${focusRing}`}
        >
          <Menu className="size-5" />
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40" />
          <Dialog.Popup
            className={`fixed inset-y-0 left-0 z-50 flex w-64 max-w-[85vw] flex-col gap-6 overflow-y-auto px-3 py-5 outline-none ${gradient}`}
          >
            <Dialog.Title className="sr-only">Menu</Dialog.Title>
            <Dialog.Close
              aria-label="Close the menu"
              className={`absolute top-3 right-2 inline-flex size-10 items-center justify-center rounded-lg hover:bg-sidebar-accent/60 ${focusRing}`}
            >
              <X className="size-5" />
            </Dialog.Close>
            <SidebarContent onNavigate={() => setOpen(false)} />
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
      <LogoMark className="size-7" />
      <span className="text-lg font-semibold tracking-[0.2em] text-sidebar-accent-foreground">
        TRADELOG
      </span>
    </header>
  )
}
