import { describe, expect, it } from "vitest"
import { formatAgo, importState, previousWeekday, summarizeImports } from "./import-freshness"

// October 2026 is on EDT (UTC-4): 15:00Z is 11:00 in New York.
const at = (day: number, hourUtc = 15, minute = 0) =>
  new Date(Date.UTC(2026, 9, day, hourUtc, minute))

describe("previousWeekday", () => {
  it("steps back one day on weekdays and skips the weekend", () => {
    expect(previousWeekday("2026-10-27")).toBe("2026-10-26") // Tuesday -> Monday
    expect(previousWeekday("2026-10-26")).toBe("2026-10-23") // Monday -> Friday
    expect(previousWeekday("2026-10-25")).toBe("2026-10-23") // Sunday -> Friday
    expect(previousWeekday("2026-10-24")).toBe("2026-10-23") // Saturday -> Friday
  })
})

describe("importState", () => {
  const tuesday = at(27)

  it("is 'never' without any import", () => {
    expect(importState(null, tuesday)).toEqual({ state: "never" })
  })

  it("is fresh when the last import was made on the previous weekday or later", () => {
    expect(importState(at(26, 9), tuesday)).toEqual({ state: "fresh" })
    expect(importState(at(26, 23), tuesday)).toEqual({ state: "fresh" })
    expect(importState(at(27, 14), tuesday)).toEqual({ state: "fresh" })
  })

  it("flags the previous weekday as missed when the last import is older", () => {
    expect(importState(at(23, 20), tuesday)).toEqual({ state: "stale", missedDay: "2026-10-26" })
    expect(importState(at(20), at(23))).toEqual({ state: "stale", missedDay: "2026-10-22" })
  })

  it("does not raise an alarm over a weekend", () => {
    expect(importState(at(23, 20), at(24))).toEqual({ state: "fresh" }) // Saturday
    expect(importState(at(23, 20), at(25))).toEqual({ state: "fresh" }) // Sunday
    expect(importState(at(23, 20), at(26))).toEqual({ state: "fresh" }) // Monday morning
    expect(importState(at(22, 20), at(24))).toEqual({ state: "stale", missedDay: "2026-10-23" })
  })

  it("uses the New York day of the import, not the UTC one", () => {
    // 01:30Z on Tuesday 27 is still Monday evening (21:30) in New York.
    const mondayEvening = at(27, 1, 30)
    expect(importState(mondayEvening, at(27))).toEqual({ state: "fresh" })
    // On Wednesday the Tuesday session is missing; going by the UTC day would hide it.
    expect(importState(mondayEvening, at(28))).toEqual({ state: "stale", missedDay: "2026-10-27" })
  })
})

describe("formatAgo", () => {
  const now = at(27, 15)

  it("picks the largest useful unit", () => {
    expect(formatAgo(new Date(now.getTime() - 20_000), now)).toBe("just now")
    expect(formatAgo(new Date(now.getTime() - 12 * 60_000), now)).toBe("12 min ago")
    expect(formatAgo(new Date(now.getTime() - 3 * 3_600_000), now)).toBe("3 h ago")
    expect(formatAgo(new Date(now.getTime() - 2 * 86_400_000 - 5000), now)).toBe("2 d ago")
  })
})

describe("summarizeImports", () => {
  const tuesday = at(27)

  it("has no date and nobody late when nothing was ever imported", () => {
    expect(summarizeImports([{ name: "A", lastImportedAt: null }], tuesday)).toEqual({
      oldest: null,
      late: [],
    })
  })

  it("keeps the oldest import and lists the late accounts, the most behind first", () => {
    const summary = summarizeImports(
      [
        { name: "A", lastImportedAt: at(26, 9) },
        { name: "B", lastImportedAt: at(22, 9) },
        { name: "C", lastImportedAt: at(23, 9) },
        { name: "D", lastImportedAt: null },
      ],
      tuesday
    )
    expect(summary.oldest).toEqual(at(22, 9))
    expect(summary.late.map((account) => account.name)).toEqual(["B", "C"])
  })

  it("reports nobody late when every account is up to date", () => {
    const summary = summarizeImports([{ name: "A", lastImportedAt: at(27, 14) }], tuesday)
    expect(summary.late).toEqual([])
  })
})
