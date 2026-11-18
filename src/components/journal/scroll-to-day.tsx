"use client"

import { useSearchParams } from "next/navigation"
import { useEffect } from "react"

/**
 * Brings the card of a day into view when the URL points at it (`/journal?month=…#day-2026-10-23`),
 * with a short highlight. The page streams in after the navigation, so the browser's own jump to the
 * anchor has nothing to land on yet: this runs once the cards are on screen.
 */
export function ScrollToDay() {
  const params = useSearchParams()

  useEffect(() => {
    const id = window.location.hash.slice(1)
    if (!id.startsWith("day-")) return
    const card = document.getElementById(id)
    if (!card) return
    const frame = requestAnimationFrame(() => {
      card.scrollIntoView({ block: "start" })
      card.animate([{ boxShadow: "0 0 0 3px var(--ring)" }, { boxShadow: "0 0 0 0 transparent" }], {
        duration: 1400,
        easing: "ease-out",
      })
    })
    return () => cancelAnimationFrame(frame)
  }, [params])

  return null
}
