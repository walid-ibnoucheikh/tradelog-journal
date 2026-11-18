/**
 * A light tap in the hand, like a native app. Browsers do not offer it the same way:
 * - Android Chrome: `navigator.vibrate`.
 * - iPhone Safari (iOS 17.4 and later): there is no vibration API, but flipping an `<input type="checkbox"
 *   switch>` makes the phone tick, so a hidden one is toggled from the tap handler. It only works inside a real
 *   tap (a click), which is where this is called from.
 * Anything else does nothing. Never throws.
 */
let toggle: HTMLLabelElement | null = null

function iosToggle(): HTMLLabelElement {
  if (toggle?.isConnected) return toggle
  const label = document.createElement("label")
  label.setAttribute("aria-hidden", "true")
  label.style.display = "none"
  const input = document.createElement("input")
  input.type = "checkbox"
  input.setAttribute("switch", "")
  label.appendChild(input)
  document.head.appendChild(label)
  toggle = label
  return label
}

export function haptic(): void {
  try {
    if (typeof navigator.vibrate === "function") {
      navigator.vibrate(8)
      return
    }
    iosToggle().click()
  } catch {
    // No haptics here: the tap still works.
  }
}
