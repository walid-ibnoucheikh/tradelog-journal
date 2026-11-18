import { NextRequest } from "next/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { SESSION_COOKIE, createSessionToken } from "@/lib/auth/auth-core"
import { config, proxy } from "./proxy"

const secret = "s".repeat(32)

function configure(env: Record<string, string> = {}) {
  vi.stubEnv("NODE_ENV", "production")
  vi.stubEnv("APP_PASSWORD", "correct horse battery")
  vi.stubEnv("SESSION_SECRET", secret)
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value)
}

async function request(path: string, init: { method?: string; signedIn?: boolean } = {}) {
  const headers = new Headers()
  if (init.signedIn) headers.set("cookie", `${SESSION_COOKIE}=${await createSessionToken(secret)}`)
  return proxy(new NextRequest(`http://localhost:3000${path}`, { method: init.method, headers }))
}

const passesThrough = (response: Response) => response.headers.get("x-middleware-next") === "1"

afterEach(() => vi.unstubAllEnvs())

describe("proxy", () => {
  it("sends a visitor without a session to the login page, remembering where they were going", async () => {
    configure()
    const response = await request("/trades?status=loss")
    expect(response.status).toBe(307)
    expect(new URL(response.headers.get("location")!).pathname).toBe("/login")
    expect(new URL(response.headers.get("location")!).searchParams.get("next")).toBe(
      "/trades?status=loss"
    )
  })

  it("does not add a next parameter for the home page", async () => {
    configure()
    const response = await request("/")
    expect(new URL(response.headers.get("location")!).search).toBe("")
  })

  it("rejects Server Action calls (POST) without a session instead of redirecting", async () => {
    configure()
    expect((await request("/accounts", { method: "POST" })).status).toBe(401)
    expect((await request("/trades/abc", { method: "POST" })).status).toBe(401)
  })

  it("lets a signed-in visitor through, on any method", async () => {
    configure()
    expect(passesThrough(await request("/journal", { signedIn: true }))).toBe(true)
    expect(passesThrough(await request("/accounts", { method: "POST", signedIn: true }))).toBe(true)
  })

  it("rejects a forged or expired cookie", async () => {
    configure()
    const forged = new NextRequest("http://localhost:3000/trades", {
      headers: { cookie: `${SESSION_COOKIE}=v1.99999999999999.${"a".repeat(64)}` },
    })
    expect((await proxy(forged)).status).toBe(307)
  })

  it("keeps the login page reachable, and bounces a signed-in visitor to the home page", async () => {
    configure()
    expect(passesThrough(await request("/login"))).toBe(true)
    expect(passesThrough(await request("/login", { method: "POST" }))).toBe(true)
    const response = await request("/login", { signedIn: true })
    expect(new URL(response.headers.get("location")!).pathname).toBe("/")
  })

  it("locks the whole app when production has no password", async () => {
    configure({ APP_PASSWORD: "" })
    const response = await request("/trades", { signedIn: false })
    expect(response.status).toBe(503)
    expect(await response.text()).toContain("APP_PASSWORD")
  })

  it("stays open locally when no password is set", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("APP_PASSWORD", "")
    expect(passesThrough(await request("/trades"))).toBe(true)
  })

  it("covers every route except Next's static files", () => {
    const pattern = new RegExp(`^${config.matcher[0]}$`.replace(/^\^\//, "^/"))
    expect(pattern.test("/trades")).toBe(true)
    expect(pattern.test("/")).toBe(true)
    expect(pattern.test("/accounts/anything")).toBe(true)
    expect(pattern.test("/_next/static/chunk.js")).toBe(false)
    expect(pattern.test("/favicon.ico")).toBe(false)
  })

  it("leaves the manifest and the icons open: a phone fetches them without the session", () => {
    const pattern = new RegExp(`^${config.matcher[0]}$`.replace(/^\^\//, "^/"))
    for (const path of [
      "/manifest.webmanifest",
      "/icon.svg",
      "/apple-icon.png",
      "/icon-192.png",
      "/icon-512.png",
    ]) {
      expect(pattern.test(path), path).toBe(false)
    }
    // A page whose name merely starts like one of them is still protected.
    expect(pattern.test("/icon-notes")).toBe(true)
  })
})
