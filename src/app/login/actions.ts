"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import {
  SESSION_COOKIE,
  SESSION_DAYS,
  authStatus,
  createSessionToken,
  passwordMatches,
  safeNextPath,
} from "@/lib/auth/auth-core"

export interface LoginState {
  error?: string
}

const FAILED_ATTEMPT_DELAY_MS = 1000

export async function login(
  next: string,
  _previous: LoginState,
  formData: FormData
): Promise<LoginState> {
  const status = authStatus(process.env)
  if (status.mode === "disabled") redirect(safeNextPath(next))
  if (status.mode === "misconfigured") return { error: status.reason }

  const password = formData.get("password")
  if (typeof password !== "string" || !(await passwordMatches(password, status.password))) {
    // Slows down guessing: each wrong attempt costs a second.
    await new Promise((resolve) => setTimeout(resolve, FAILED_ATTEMPT_DELAY_MS))
    return { error: "Wrong password." }
  }

  ;(await cookies()).set(SESSION_COOKIE, await createSessionToken(status.secret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  })
  redirect(safeNextPath(next))
}

export async function logout() {
  ;(await cookies()).delete(SESSION_COOKIE)
  redirect("/login")
}
