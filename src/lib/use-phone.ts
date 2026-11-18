import { useSyncExternalStore } from "react"

const QUERY = "(max-width: 639px)"

function subscribe(onChange: () => void) {
  const media = window.matchMedia(QUERY)
  media.addEventListener("change", onChange)
  return () => media.removeEventListener("change", onChange)
}

/** True on a phone-sized screen; false on the server (the page then corrects itself on the first render). */
export function usePhone() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false
  )
}
