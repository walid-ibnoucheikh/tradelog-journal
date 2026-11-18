"use client"

import { Moon, Sun } from "lucide-react"
import { useSyncExternalStore } from "react"

const root = () => document.documentElement

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(root(), { attributes: true, attributeFilter: ["class"] })
  return () => observer.disconnect()
}

/** Light / dark switch. The choice is kept in localStorage; the class on <html> is the source of truth. */
export function ThemeToggle() {
  const dark = useSyncExternalStore(
    subscribe,
    () => root().classList.contains("dark"),
    () => false
  )

  function toggle() {
    const next = !root().classList.contains("dark")
    root().classList.toggle("dark", next)
    try {
      localStorage.setItem("theme", next ? "dark" : "light")
    } catch {
      // Private mode: the choice just is not remembered.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-sidebar-accent/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white lg:size-9"
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  )
}
