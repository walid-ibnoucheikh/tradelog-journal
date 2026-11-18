/**
 * The command line of `npm run agent:export-cloud -- [--no-logins] <prop firm> ...`: the prop firms
 * and whether the vault leaves the saved logins out (they live in the app, only the browser states
 * are needed in the GitHub secret).
 */
export function parseExportArgs(argv) {
  const noLogins = argv.includes("--no-logins")
  const unknown = argv.filter((arg) => arg.startsWith("--") && arg !== "--no-logins")
  if (unknown.length > 0) throw new Error(`Unknown option: ${unknown.join(" ")}`)
  const firms = argv
    .filter((arg) => !arg.startsWith("--"))
    .map((name) => name.trim())
    .filter(Boolean)
  return { firms, noLogins }
}
