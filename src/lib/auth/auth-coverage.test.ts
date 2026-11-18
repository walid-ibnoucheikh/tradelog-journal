import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const APP_DIR = join(process.cwd(), "src", "app")
// The login and logout actions are what hand out the session in the first place.
const EXEMPT = [join("login", "actions.ts")]

const serverActionFiles = (readdirSync(APP_DIR, { recursive: true }) as string[])
  .filter((file) => /\.(ts|tsx)$/.test(file) && !EXEMPT.some((exempt) => file.endsWith(exempt)))
  .filter((file) => /^\s*["']use server["']/.test(readFileSync(join(APP_DIR, file), "utf8")))

describe("Server Actions are protected by the password", () => {
  it("finds the Server Action files", () => {
    expect(serverActionFiles.length).toBeGreaterThanOrEqual(5)
  })

  it.each(serverActionFiles)("%s calls requireAuth() first in every exported action", (file) => {
    const source = readFileSync(join(APP_DIR, file), "utf8")
    const actions = source.split(/^export async function /m).slice(1)
    expect(actions.length).toBeGreaterThan(0)
    for (const action of actions) {
      const name = action.slice(0, action.indexOf("("))
      const body = action.slice(action.indexOf("{", action.indexOf(")")) + 1)
      // The first statement of the body must be the check, before any read or write.
      expect(body.trimStart().startsWith("await requireAuth()"), `${file}: ${name}`).toBe(true)
    }
  })
})
