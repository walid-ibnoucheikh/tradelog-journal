import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const APP_DIR = join(process.cwd(), "src", "app")
const read = (file: string) => readFileSync(join(APP_DIR, file), "utf8")
const allFiles = (readdirSync(APP_DIR, { recursive: true }) as string[]).filter((file) =>
  /\.(ts|tsx)$/.test(file)
)

// Actions that change no cached data: signing in and out, the sync queue and the saved Tradovate logins (not cached).
const NO_DATA_WRITE = [
  "login",
  "logout",
  "requestSyncAction",
  "cancelSyncAction",
  "saveLoginAction",
  "removeLoginAction",
]

const serverActionFiles = allFiles.filter((file) => /^\s*["']use server["']/.test(read(file)))

describe("cached pages are refreshed after every write", () => {
  it("finds the Server Action files", () => {
    expect(serverActionFiles.length).toBeGreaterThanOrEqual(5)
  })

  it.each(serverActionFiles)("%s drops the cache in every action that writes", (file) => {
    const actions = read(file)
      .split(/^export async function /m)
      .slice(1)
    for (const action of actions) {
      const name = action.slice(0, action.indexOf("("))
      if (NO_DATA_WRITE.includes(name)) continue
      expect(/afterWrite\(\)|updateTag\(DATA_TAG\)/.test(action), `${file}: ${name}`).toBe(true)
    }
  })

  // The cloud sync imports files and reports what it found through routes, not Server Actions.
  it.each(["api/sync/[id]/files/route.ts", "api/sync/[id]/finish/route.ts"])(
    "%s drops the cache",
    (file) => {
      expect(read(file)).toContain("invalidateData()")
    }
  )
})
