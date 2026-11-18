"use client"

import { ChevronsDownUp, ChevronsUpDown } from "lucide-react"
import { useRef } from "react"
import { Button } from "@/components/ui/button"

export const TOGGLE_ALL_EVENT = "journal:toggle-all"

export function ExpandControls() {
  const controls = useRef<HTMLDivElement>(null)

  /**
   * Folds or unfolds every day. The page changes height a lot while the cards slide: on a phone the browser
   * would then shift the content under the finger. The controls are kept where they are on the screen until the
   * slide is over, so the page stays steady.
   */
  function toggleAll(open: boolean) {
    const before = controls.current?.getBoundingClientRect().top ?? 0
    window.dispatchEvent(new CustomEvent(TOGGLE_ALL_EVENT, { detail: open }))
    const started = performance.now()
    const hold = () => {
      const now = controls.current?.getBoundingClientRect().top
      if (now !== undefined && Math.abs(now - before) > 1) window.scrollBy(0, now - before)
      if (performance.now() - started < 320) requestAnimationFrame(hold)
    }
    requestAnimationFrame(hold)
  }

  return (
    <div ref={controls} className="flex gap-2">
      <Button variant="outline" onClick={() => toggleAll(false)}>
        <ChevronsDownUp />
        Collapse all
      </Button>
      <Button variant="outline" onClick={() => toggleAll(true)}>
        <ChevronsUpDown />
        Expand all
      </Button>
    </div>
  )
}
