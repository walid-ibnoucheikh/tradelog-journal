"use client"

import { useEffect } from "react"
import { haptic } from "@/lib/haptics"

/** What answers a tap: buttons, links, tabs, summaries. */
const TAPPABLE = 'a[href], button:not(:disabled), [role="tab"], [role="button"], summary'

/** Makes the app feel native on a phone: a light haptic tick on every tap. Nothing on a mouse. */
export function TouchFeel() {
  useEffect(() => {
    if (!matchMedia("(pointer: coarse)").matches) return
    function onClick(event: MouseEvent) {
      if (event.target instanceof Element && event.target.closest(TAPPABLE)) haptic()
    }
    document.addEventListener("click", onClick, true)
    return () => document.removeEventListener("click", onClick, true)
  }, [])
  return null
}
