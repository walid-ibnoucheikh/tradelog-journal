/** "localhost" or "tradelog.example.com": how an app is called in messages. */
export const targetName = (origin) => new URL(origin).hostname

/**
 * The app the cloud run serves and the token that proves it, from the environment. In GitHub,
 * `TRADELOG_URLS` holds the online address; locally (`npm run agent:cloud-local`) the local app.
 * `TRADELOG_URL` is a single address; the default is the local app. The token is `SYNC_TOKEN`.
 */
export function loadConfig(env = process.env) {
  const token = env.SYNC_TOKEN ?? ""
  if (token.length < 32) throw new Error("SYNC_TOKEN is missing or shorter than 32 characters.")

  const listed = (env.TRADELOG_URLS ?? env.TRADELOG_URL ?? "http://localhost:3000")
    .split(",")
    .map((text) => text.trim())
    .filter(Boolean)
  if (listed.length === 0) throw new Error("TRADELOG_URLS is empty.")

  const targets = []
  for (const text of listed) {
    const url = new URL(text)
    const local = ["localhost", "127.0.0.1"].includes(url.hostname)
    // The token travels in a header: never over plain http beyond this machine.
    if (url.protocol !== "https:" && !local) {
      throw new Error(`${url.origin}: the address must use https, except for localhost.`)
    }
    if (!targets.some((target) => target.baseUrl === url.origin)) {
      targets.push({ name: targetName(url.origin), baseUrl: url.origin })
    }
  }
  return { targets, token }
}
