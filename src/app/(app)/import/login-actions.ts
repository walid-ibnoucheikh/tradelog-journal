"use server"

import { refresh } from "next/cache"
import { loginStorageReady, removeTradovateLogin, saveLoginUnderKey } from "@/db/tradovate-logins"
import { requireAuth } from "@/lib/auth/auth"
import { LOGIN_STORAGE_OFF, readLogin } from "@/lib/credentials/login-input"
import { firmKey } from "@/lib/sync/firm-key"

export interface LoginFormState {
  error?: string
  saved?: string
}

const field = (formData: FormData, key: string, trim = true) => {
  const value = formData.get(key)
  return typeof value === "string" ? (trim ? value.trim() : value) : ""
}

/** The login chosen in the form: `{"key", "firm", "label"}` (what the list offers). */
function readTarget(
  formData: FormData
): { key: string; firm: string; label: string | null } | null {
  try {
    const parsed = JSON.parse(field(formData, "login")) as {
      key?: unknown
      firm?: unknown
      label?: unknown
    }
    if (typeof parsed.key !== "string" || typeof parsed.firm !== "string") return null
    if (!firmKey(parsed.firm)) return null
    const label = typeof parsed.label === "string" && parsed.label ? parsed.label : null
    return { key: parsed.key, firm: parsed.firm, label }
  } catch {
    return null
  }
}

/** The "Tradovate logins" form: saves (or replaces) a login, encrypted. */
export async function saveLoginAction(
  _previous: LoginFormState,
  formData: FormData
): Promise<LoginFormState> {
  await requireAuth()
  const target = readTarget(formData)
  if (!target) return { error: "Choose the login." }
  // The username is trimmed, the password never: spaces may belong to it.
  const parsed = readLogin(field(formData, "username"), field(formData, "password", false))
  if ("none" in parsed) return { error: "Enter the Tradovate username and password." }
  if ("error" in parsed) return { error: parsed.error }
  if (!loginStorageReady()) return { error: LOGIN_STORAGE_OFF }
  await saveLoginUnderKey(target.key, target.firm, target.label, parsed.login)
  refresh()
  return {
    saved: `Login saved for ${target.label ? `${target.firm} · ${target.label}` : target.firm}.`,
  }
}

/** The "Remove" button of a saved login (by its key). */
export async function removeLoginAction(formData: FormData) {
  await requireAuth()
  const key = field(formData, "key")
  if (key) await removeTradovateLogin(key)
  refresh()
}
