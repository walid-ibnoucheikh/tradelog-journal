"use client"

import { useLayoutEffect, useRef, useState } from "react"

/**
 * Replays the entrance animations (cards, gauges, charts) each time a page is shown again.
 * Next keeps visited pages alive but hidden (React Activity), so a page you come back to never remounts
 * and its animations would only ever run once. Activity re-runs layout effects when the page is shown
 * again: we use that moment to remount the content, before the browser paints.
 */
export function PageMotion({ children }: { children: React.ReactNode }) {
  const [run, setRun] = useState(0)
  const seen = useRef(false)

  useLayoutEffect(() => {
    if (seen.current) setRun((current) => current + 1)
    seen.current = true
  }, [])

  return (
    <div key={run} className="contents">
      {children}
    </div>
  )
}
