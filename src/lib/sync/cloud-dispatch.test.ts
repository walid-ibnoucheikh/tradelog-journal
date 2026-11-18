import { describe, expect, it, vi } from "vitest"
import { CLOUD_WORKFLOW, dispatchCloudSync, loadCloudSync, syncMode } from "./cloud-dispatch"

const token = "github_pat_" + "x".repeat(30)
const config = { repo: "me/tradelog", token, ref: "main" }

describe("loadCloudSync", () => {
  it("is off without a repository and a token", () => {
    expect(loadCloudSync({})).toBeNull()
    expect(loadCloudSync({ CLOUD_SYNC_REPO: "me/tradelog" })).toBeNull()
    expect(loadCloudSync({ CLOUD_SYNC_TOKEN: token })).toBeNull()
  })

  it("reads the settings, with main as the default branch", () => {
    expect(loadCloudSync({ CLOUD_SYNC_REPO: "me/tradelog", CLOUD_SYNC_TOKEN: token })).toEqual(
      config
    )
  })

  it("rejects a repository or branch that could change the request address", () => {
    const env = { CLOUD_SYNC_TOKEN: token }
    expect(loadCloudSync({ ...env, CLOUD_SYNC_REPO: "me/tradelog/../x" })).toBeNull()
    expect(loadCloudSync({ ...env, CLOUD_SYNC_REPO: "me/tradelog?x=1" })).toBeNull()
    expect(
      loadCloudSync({ ...env, CLOUD_SYNC_REPO: "me/tradelog", CLOUD_SYNC_REF: "a b" })
    ).toBeNull()
  })
})

describe("syncMode", () => {
  const cloud = { CLOUD_SYNC_REPO: "me/tradelog", CLOUD_SYNC_TOKEN: token }

  it("starts the workflow in production, and says so when it is not set up", () => {
    expect(syncMode({ ...cloud, NODE_ENV: "production" })).toBe("cloud")
    expect(syncMode({ NODE_ENV: "production" })).toBeNull()
    expect(syncMode({})).toBeNull()
  })

  it("never starts the workflow in development, even with the GitHub settings", () => {
    expect(syncMode({ NODE_ENV: "development" })).toBe("local")
    expect(syncMode({ ...cloud, NODE_ENV: "development" })).toBe("local")
  })
})

describe("dispatchCloudSync", () => {
  it("calls the workflow dispatch route with the token and the branch", async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 204 }))
    expect(await dispatchCloudSync(config, fetcher as unknown as typeof fetch)).toEqual({
      ok: true,
    })
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(
      `https://api.github.com/repos/me/tradelog/actions/workflows/${CLOUD_WORKFLOW}/dispatches`
    )
    expect(init.method).toBe("POST")
    expect((init.headers as Record<string, string>).authorization).toBe(`Bearer ${token}`)
    expect(JSON.parse(init.body as string)).toEqual({ ref: "main" })
  })

  it.each([
    [401, /refused the token/],
    [403, /Actions: write/],
    [404, /Actions: write/],
    [422, /branch or workflow/],
    [500, /answered 500/],
  ])("explains a %s answer without leaking the token", async (status, message) => {
    const fetcher = vi.fn(async () => new Response("{}", { status }))
    const result = await dispatchCloudSync(config, fetcher as unknown as typeof fetch)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(message)
      expect(result.error).not.toContain(token)
    }
  })

  it("says so when GitHub cannot be reached", async () => {
    const fetcher = vi.fn(async () => {
      throw new Error("network")
    })
    expect(await dispatchCloudSync(config, fetcher as unknown as typeof fetch)).toEqual({
      ok: false,
      error: "GitHub could not be reached.",
    })
  })
})
