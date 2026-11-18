"use client"

import { Dialog } from "@base-ui/react/dialog"
import { X } from "lucide-react"
import { createContext, useCallback, useContext, useState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** What a form calls after a successful save; a window or a panel provides what "close" means. */
export const CloseContext = createContext<() => void>(() => {})

/** Closes the window a form sits in; forms call it once their action has succeeded. */
export function useModalClose() {
  return useContext(CloseContext)
}

/**
 * A button that opens a window over the page. The content is only mounted while the window is
 * open, so a form inside always starts fresh.
 */
export function ModalButton({
  label,
  icon,
  title,
  description,
  wide = false,
  variant = "default",
  size = "default",
  className,
  children,
}: {
  label: string
  icon?: React.ReactNode
  title: string
  description?: string
  /** Wider window for forms with several columns. */
  wide?: boolean
  variant?: React.ComponentProps<typeof Button>["variant"]
  size?: React.ComponentProps<typeof Button>["size"]
  className?: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger render={<Button variant={variant} size={size} className={className} />}>
        {icon}
        {label}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
        <Dialog.Popup
          // A tap must not put the cursor in the first field: the iPhone keyboard would open at once and
          // push the window out of the screen. With a mouse or the keyboard the first field keeps the focus.
          initialFocus={(type) => type !== "touch"}
          className={cn(
            // On a phone the window hangs from the top and scrolls inside: it does not recentre when the keyboard opens.
            "fixed top-1/2 left-1/2 z-50 max-h-[90dvh] w-[min(var(--modal-width),calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto overscroll-contain rounded-xl border bg-card text-card-foreground shadow-xl outline-none max-sm:top-3 max-sm:left-4 max-sm:max-h-[calc(100dvh-1.5rem)] max-sm:translate-none",
            wide ? "[--modal-width:48rem]" : "[--modal-width:30rem]"
          )}
        >
          <div className="flex items-start gap-3 border-b px-5 py-4">
            <div className="min-w-0">
              <Dialog.Title className="text-base font-semibold">{title}</Dialog.Title>
              {description && (
                <Dialog.Description className="mt-0.5 text-sm text-muted-foreground">
                  {description}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close
              aria-label="Close"
              className="ml-auto inline-flex size-8 shrink-0 items-center justify-center rounded hover:bg-muted"
            >
              <X className="size-4" />
            </Dialog.Close>
          </div>
          <div className="p-5">
            <CloseContext.Provider value={close}>{children}</CloseContext.Provider>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
