import { describe, expect, it } from "vitest"
import { splitResultMessage } from "./result-message"

describe("splitResultMessage", () => {
  it("keeps the problems apart from the synced accounts", () => {
    const message = [
      "2 of 4 accounts synced · 1 need a new login · 1 failed",
      "⚠ Lucid (1 account): renew it",
      "✗ Tradeify 3: boom",
      "✓ Tradeify 1: 2 new fills, 1 new fee",
      "✓ Tradeify 2: no activity in the period",
    ].join("\n")
    expect(splitResultMessage(message)).toEqual({
      summary: "2 of 4 accounts synced · 1 need a new login · 1 failed",
      problems: [
        { line: "⚠ Lucid (1 account): renew it", detail: [] },
        { line: "✗ Tradeify 3: boom", detail: [] },
      ],
      synced: [
        { line: "✓ Tradeify 1: 2 new fills, 1 new fee", detail: [] },
        { line: "✓ Tradeify 2: no activity in the period", detail: [] },
      ],
    })
  })

  it("attaches the indented lines to the line above, as its detail", () => {
    const message = [
      "0 of 2 accounts synced · 2 failed",
      "✗ A: Tradovate did not respond as expected (Timeout 30000ms exceeded)",
      "  waiting for locator('select')",
      "  retrying select option action",
      "✗ B: boom",
    ].join("\n")
    expect(splitResultMessage(message).problems).toEqual([
      {
        line: "✗ A: Tradovate did not respond as expected (Timeout 30000ms exceeded)",
        detail: ["waiting for locator('select')", "retrying select option action"],
      },
      { line: "✗ B: boom", detail: [] },
    ])
  })

  it("has nothing to unfold for a one-line message, or no message", () => {
    expect(splitResultMessage("The cloud run stopped answering.")).toEqual({
      summary: "The cloud run stopped answering.",
      problems: [],
      synced: [],
    })
    expect(splitResultMessage(null)).toEqual({ summary: "", problems: [], synced: [] })
  })

  it("ignores blank lines", () => {
    expect(splitResultMessage("All 1 accounts synced\n\n✓ A: ok\n").synced).toEqual([
      { line: "✓ A: ok", detail: [] },
    ])
  })
})
