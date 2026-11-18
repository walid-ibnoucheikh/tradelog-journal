/** The cloud run's side of the app's /api/sync routes. */
export function createApi({ baseUrl, token }) {
  async function call(path, init = {}) {
    const response = await fetch(`${baseUrl}/api/sync${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${token}`,
        ...(init.body ? { "content-type": "application/json" } : {}),
      },
      signal: AbortSignal.timeout(60_000),
    }).catch(() => {
      // Not "fetch failed": say which app cannot be reached.
      throw new Error(`cannot reach ${baseUrl}`)
    })
    const body = await response.json().catch(() => ({}))
    return { status: response.status, body }
  }

  return {
    /** The oldest waiting request, or null. */
    async next() {
      const { status, body } = await call("/next")
      if (status === 401) throw new Error("The app refused the token (SYNC_TOKEN differs).")
      if (status === 503) throw new Error("The app has no SYNC_TOKEN set.")
      if (status !== 200) throw new Error(`Unexpected answer ${status} from the app.`)
      return { request: body.request }
    },
    /** Queues a sync of all active accounts (the daily run); an open request is reused. */
    async schedule() {
      const { status } = await call("/schedule", { method: "POST" })
      if (status === 401) throw new Error("The app refused the token (SYNC_TOKEN differs).")
      if (status === 503) throw new Error("The app has no SYNC_TOKEN set.")
      if (status !== 200) throw new Error(`Unexpected answer ${status} from the app.`)
    },
    /** Hands over an account's CSV files. `cancelled` is true when the request was closed meanwhile. */
    async upload(id, files) {
      const { status, body } = await call(`/${id}/files`, {
        method: "POST",
        body: JSON.stringify(files),
      })
      if (status === 409) return { cancelled: true }
      if (status !== 200) throw new Error(body.error ?? `The import was refused (${status}).`)
      return { summary: body }
    },
    /**
     * `found` / `missing` are the ids of the accounts that were / were not in the Tradovate login;
     * `empty` those exported with no activity in the period.
     */
    async finish(id, status, message, { found = [], missing = [], empty = [] } = {}) {
      await call(`/${id}/finish`, {
        method: "POST",
        body: JSON.stringify({ status, message, found, missing, empty }),
      })
    },
  }
}
