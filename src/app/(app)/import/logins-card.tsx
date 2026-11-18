import { ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { listAccounts } from "@/db/queries"
import { listSavedLogins, loginStorageReady } from "@/db/tradovate-logins"
import { loginItems, loginTitle } from "@/lib/sync/login-items"
import { removeLoginAction } from "./login-actions"
import { LoginForm } from "./login-form"

/** Which prop firms have a Tradovate login saved for the cloud sync, and a form to save one. */
export async function LoginsCard() {
  const [accounts, saved] = await Promise.all([listAccounts(), listSavedLogins()])
  const items = loginItems(accounts, saved)
  const ready = loginStorageReady()

  return (
    <details className="group rounded-xl border bg-card">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl px-5 py-4 [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-4 text-muted-foreground transition-transform group-open:rotate-90" />
        <h2 className="text-base font-medium">Tradovate logins</h2>
      </summary>
      <div className="space-y-4 px-5 pb-5">
        <p className="text-sm text-muted-foreground">
          The Tradovate logins the sync uses: one per prop firm, plus one for each other Tradovate
          login an account uses. Stored encrypted, never shown again; saving again replaces it. You
          can also give it when adding an account.
        </p>
        {!ready && (
          <p role="alert" className="text-sm text-destructive">
            Not set up: <code className="font-mono">CREDENTIALS_KEY</code> is missing in the
            app&apos;s environment.
          </p>
        )}
        <ul className="divide-y rounded-lg border">
          {items.map((item) => (
            <li key={item.key} className="flex items-center gap-3 px-3 py-2 text-sm">
              <span className="flex-1">
                <span className="font-medium">{loginTitle(item)}</span>
                {item.accounts.length > 0 && (
                  <span className="block text-xs text-muted-foreground">
                    {item.accounts.join(", ")}
                  </span>
                )}
              </span>
              {item.saved ? (
                <>
                  <span className="text-profit-text">Login saved</span>
                  <form action={removeLoginAction}>
                    <input type="hidden" name="key" value={item.key} />
                    <Button type="submit" variant="ghost" size="sm">
                      Remove
                    </Button>
                  </form>
                </>
              ) : (
                <span className="text-muted-foreground">No login saved</span>
              )}
            </li>
          ))}
          {items.length === 0 && (
            <li className="px-3 py-2 text-sm text-muted-foreground">No active account yet.</li>
          )}
        </ul>
        {ready && items.length > 0 && (
          <LoginForm
            logins={items.map((item) => ({
              title: loginTitle(item),
              value: JSON.stringify({ key: item.key, firm: item.firm, label: item.label }),
            }))}
          />
        )}
      </div>
    </details>
  )
}
