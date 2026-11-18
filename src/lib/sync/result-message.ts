/**
 * A sync's result message is a summary line, then one line per account or prop firm, each starting
 * with ✓ (synced), ⚠ (login to renew) or ✗ (failed): see `formatOutcome` in agent/cloud-core.mjs.
 * A line can be followed by indented lines: the technical detail of that line (a failure's log).
 * The page keeps the problems in view, folds their detail and the ✓ lines away.
 */
export interface ResultLine {
  line: string
  /** The indented lines under it, without their indentation. */
  detail: string[]
}

export interface ResultMessage {
  summary: string
  /** Lines that need a look: ⚠, ✗, or anything that is not a ✓ line. */
  problems: ResultLine[]
  synced: ResultLine[]
}

export function splitResultMessage(message: string | null): ResultMessage {
  const [summary = "", ...lines] = (message ?? "").split("\n")
  const problems: ResultLine[] = []
  const synced: ResultLine[] = []
  let current: ResultLine | null = null
  for (const raw of lines) {
    if (raw.trim() === "") continue
    if (/^\s/.test(raw) && current) {
      current.detail.push(raw.trim())
      continue
    }
    current = { line: raw, detail: [] }
    ;(raw.startsWith("✓") ? synced : problems).push(current)
  }
  return { summary, problems, synced }
}
