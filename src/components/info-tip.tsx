"use client"

import { Popover } from "@base-ui/react/popover"
import { Info } from "lucide-react"

/** Info icon that shows its content on hover or keyboard focus, and on tap on a phone. */
export function InfoTip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Popover.Root>
      <Popover.Trigger
        openOnHover
        delay={100}
        aria-label={label}
        className="inline-flex size-6 items-center justify-center rounded-full max-sm:-m-2.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <Info className="size-4" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={8} className="z-50">
          <Popover.Popup className="w-[min(37rem,calc(100vw-2rem))] space-y-1 rounded-lg border bg-popover px-4 py-3 text-xs text-popover-foreground shadow-lg outline-none">
            {children}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
