import { describe, expect, it } from "vitest"
import { FIRST_SYNC_DAYS, OVERLAP_DAYS, syncWindow } from "./sync-window"

const now = new Date("2026-11-03T15:00:00Z")

describe("syncWindow", () => {
  it("goes back 30 days for an account that was never synced", () => {
    expect(syncWindow({ lastImportedAt: null, lastFillAt: null }, now)).toEqual({
      from: "2026-10-04",
      to: "2026-11-03",
    })
    expect(FIRST_SYNC_DAYS).toBe(30)
  })

  it("ends on the trading day, which is tomorrow's date once the session has opened (18:00 ET)", () => {
    // 02:00 UTC on the 12th = 21:00 ET on the 11th: an Asian session fill is a fill of the 12th.
    const evening = new Date("2026-11-12T02:00:00Z")
    expect(syncWindow({ lastImportedAt: null, lastFillAt: null }, evening).to).toBe("2026-11-12")
    // Before the session opens (16:00 ET), the trading day is still the calendar day.
    const afternoon = new Date("2026-11-11T21:00:00Z")
    expect(syncWindow({ lastImportedAt: null, lastFillAt: null }, afternoon).to).toBe("2026-11-11")
  })

  it("starts a week before the last import when there is no fill yet", () => {
    const window = syncWindow(
      { lastImportedAt: new Date("2026-10-28T10:00:00Z"), lastFillAt: null },
      now
    )
    expect(window.from).toBe("2026-10-21")
    expect(OVERLAP_DAYS).toBe(7)
  })

  it("uses the older of the last import and the last fill", () => {
    // A short file imported late: the last fill is older, so the gap is covered.
    expect(
      syncWindow(
        {
          lastImportedAt: new Date("2026-10-28T10:00:00Z"),
          lastFillAt: new Date("2026-10-10T14:00:00Z"),
        },
        now
      ).from
    ).toBe("2026-10-03")
    // A recent import with an older last fill (quiet days): the fill still wins.
    expect(
      syncWindow(
        {
          lastImportedAt: new Date("2026-10-02T10:00:00Z"),
          lastFillAt: new Date("2026-10-20T14:00:00Z"),
        },
        now
      ).from
    ).toBe("2026-09-25")
  })
})
