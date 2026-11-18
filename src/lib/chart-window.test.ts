import { describe, expect, it } from "vitest"
import { windowRange } from "./chart-window"

describe("windowRange", () => {
  it("shows the last bars by default", () => {
    expect(windowRange(150, 60, 0)).toEqual({
      start: 90,
      end: 150,
      offset: 0,
      hasOlder: true,
      hasNewer: false,
    })
  })

  it("moves back by whole windows and stops at the first bar", () => {
    expect(windowRange(150, 60, 60)).toMatchObject({ start: 30, end: 90, hasOlder: true })
    const oldest = windowRange(150, 60, 120)
    expect(oldest).toMatchObject({ start: 0, end: 60, offset: 90, hasOlder: false, hasNewer: true })
  })

  it("never goes past the newest bar or below the oldest", () => {
    expect(windowRange(150, 60, -30)).toMatchObject({ start: 90, end: 150, offset: 0 })
    expect(windowRange(150, 60, 9999)).toMatchObject({ start: 0, end: 60 })
  })

  it("shows everything when the series fits in one window", () => {
    expect(windowRange(40, 60, 0)).toEqual({
      start: 0,
      end: 40,
      offset: 0,
      hasOlder: false,
      hasNewer: false,
    })
    expect(windowRange(0, 60, 0)).toMatchObject({ start: 0, end: 0 })
  })

  it("accepts an unlimited size, and ignores a broken offset", () => {
    expect(windowRange(150, Number.POSITIVE_INFINITY, 0)).toMatchObject({ start: 0, end: 150 })
    expect(windowRange(150, 60, Number.NaN)).toMatchObject({ start: 90, end: 150 })
  })
})
