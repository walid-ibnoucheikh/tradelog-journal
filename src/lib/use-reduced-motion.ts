import { useSyncExternalStore } from "react"

const QUERY = "(prefers-reduced-motion: reduce)"

function subscribe(onChange: () => void) {
  const media = window.matchMedia(QUERY)
  media.addEventListener("change", onChange)
  return () => media.removeEventListener("change", onChange)
}

/** True when the system asks for less motion; false on the server. */
export function useReducedMotion() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false
  )
}

/**
 * Series charts (area, bars, scatter) are not animated by Recharts: it redraws every point on every
 * frame in JavaScript, so the cost grows with the number of trades. They reveal themselves with a CSS
 * clip (`.chart-reveal`, on the compositor, same cost for 10 or 10,000 points) instead.
 */
export const noChartAnimation = { isAnimationActive: false } as const

/** Props for a small Recharts chart (the score radar, 6 points): a short entrance animation, off for reduced motion. */
export function useChartAnimation() {
  const reduced = useReducedMotion()
  return {
    isAnimationActive: !reduced,
    animationDuration: 800,
    animationEasing: "ease-out",
  } as const
}
