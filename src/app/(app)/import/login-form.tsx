"use client"

import { useActionState } from "react"
import { Field, selectClass } from "@/components/form-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { saveLoginAction, type LoginFormState } from "./login-actions"

/** Saves the Tradovate login of a prop firm. The password is never shown again, nor sent back. */
export function LoginForm({ logins }: { logins: { title: string; value: string }[] }) {
  const [state, action, pending] = useActionState<LoginFormState, FormData>(saveLoginAction, {})
  return (
    <form action={action} className="grid items-end gap-3 sm:grid-cols-4">
      <Field label="Login for">
        <select name="login" className={selectClass} required defaultValue={logins[0]?.value}>
          {logins.map((login) => (
            <option key={login.value} value={login.value}>
              {login.title}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Tradovate username">
        <Input name="username" autoComplete="off" required />
      </Field>
      <Field label="Tradovate password">
        <Input name="password" type="password" autoComplete="new-password" required />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save login"}
      </Button>
      {state.error && (
        <p role="alert" className="text-sm text-destructive sm:col-span-4">
          {state.error}
        </p>
      )}
      {state.saved && <p className="text-sm text-profit-text sm:col-span-4">{state.saved}</p>}
    </form>
  )
}
