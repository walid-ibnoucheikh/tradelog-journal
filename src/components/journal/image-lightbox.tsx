"use client"

import { Dialog } from "@base-ui/react/dialog"
import { Maximize2, Minimize2, X } from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"

/**
 * A picture of a note shown big over the page: fitted to the screen first, one click for its real pixels
 * (scroll to move around), which is what a chart screenshot needs to be read. Esc or the cross closes it.
 */
export function ImageLightbox({ src, onClose }: { src: string | null; onClose: () => void }) {
  const [actualSize, setActualSize] = useState(false)

  return (
    <Dialog.Root
      open={src !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose()
          setActualSize(false)
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[80] bg-black/85" />
        <Dialog.Popup className="fixed inset-0 z-[80] flex flex-col outline-none">
          <Dialog.Title className="sr-only">Picture</Dialog.Title>
          <div className="flex shrink-0 items-center justify-end gap-2 p-3 text-white">
            <button
              type="button"
              onClick={() => setActualSize(!actualSize)}
              className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm hover:bg-white/15"
            >
              {actualSize ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
              {actualSize ? "Fit to screen" : "Real size"}
            </button>
            <Dialog.Close
              aria-label="Close"
              className="inline-flex size-9 items-center justify-center rounded-lg hover:bg-white/15"
            >
              <X className="size-5" />
            </Dialog.Close>
          </div>
          <div
            className="flex min-h-0 flex-1 overflow-auto p-4 pt-0"
            // A click outside the picture closes the view, like in a photo viewer.
            onClick={(event) => {
              if (event.target === event.currentTarget) onClose()
            }}
          >
            {src && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={src}
                alt=""
                onClick={() => setActualSize(!actualSize)}
                className={cn(
                  "m-auto rounded-lg",
                  actualSize
                    ? "max-w-none cursor-zoom-out"
                    : "max-h-full max-w-full cursor-zoom-in object-contain"
                )}
              />
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
