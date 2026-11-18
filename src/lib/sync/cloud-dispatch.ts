/**
 * Starts the "Cloud sync" GitHub workflow from the app, the only way Tradovate is synced.
 * The workflow logs in to Tradovate in a GitHub runner, exports the files of the waiting sync
 * request and sends them back to the app. It needs two environment variables, set by the owner:
 *   CLOUD_SYNC_REPO   "owner/repository" holding the workflow
 *   CLOUD_SYNC_TOKEN  a fine-grained GitHub token limited to that repository, with "Actions: write"
 * Without both, the Sync buttons are replaced by a note saying what is missing.
 */

export const CLOUD_WORKFLOW = "cloud-sync.yml"

export interface CloudSyncConfig {
  repo: string
  token: string
  ref: string
}

const REPO = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/
const REF = /^[A-Za-z0-9_./-]+$/

/** The cloud sync settings from the environment, or null when it is not set up (or malformed). */
export function loadCloudSync(env: Record<string, string | undefined>): CloudSyncConfig | null {
  const repo = (env.CLOUD_SYNC_REPO ?? "").trim()
  const token = (env.CLOUD_SYNC_TOKEN ?? "").trim()
  const ref = (env.CLOUD_SYNC_REF ?? "main").trim()
  if (!REPO.test(repo) || !REF.test(ref) || token.length < 20) return null
  return { repo, token, ref }
}

/**
 * How the Sync buttons work here:
 *   cloud  the request is queued and the GitHub workflow started (production)
 *   local  the same run is started on this PC (local-run.ts): in development the workflow would
 *          ask the online app for work, never this one, so it is never started from `next dev`,
 *          even when the GitHub settings are present
 *   null   not set up: the buttons are replaced by a note
 */
export type SyncMode = "cloud" | "local"

export function syncMode(env: Record<string, string | undefined>): SyncMode | null {
  if (env.NODE_ENV === "development") return "local"
  return loadCloudSync(env) ? "cloud" : null
}

export type DispatchResult = { ok: true } | { ok: false; error: string }

/** Asks GitHub to run the workflow. Never throws: the answer says what went wrong, in words. */
export async function dispatchCloudSync(
  config: CloudSyncConfig,
  fetcher: typeof fetch = fetch
): Promise<DispatchResult> {
  let response: Response
  try {
    response = await fetcher(
      `https://api.github.com/repos/${config.repo}/actions/workflows/${CLOUD_WORKFLOW}/dispatches`,
      {
        method: "POST",
        headers: {
          accept: "application/vnd.github+json",
          authorization: `Bearer ${config.token}`,
          "content-type": "application/json",
          "user-agent": "tradelog",
          "x-github-api-version": "2022-11-28",
        },
        body: JSON.stringify({ ref: config.ref }),
        signal: AbortSignal.timeout(15_000),
      }
    )
  } catch {
    return { ok: false, error: "GitHub could not be reached." }
  }
  if (response.status === 204) return { ok: true }
  if (response.status === 401) return { ok: false, error: "GitHub refused the token." }
  if (response.status === 403 || response.status === 404) {
    return {
      ok: false,
      error: "GitHub refused: check the token (Actions: write) and that the workflow exists.",
    }
  }
  if (response.status === 422) {
    return { ok: false, error: "GitHub could not find that branch or workflow." }
  }
  return { ok: false, error: `GitHub answered ${response.status}.` }
}
