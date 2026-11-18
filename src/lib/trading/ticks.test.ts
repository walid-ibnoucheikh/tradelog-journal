import { describe, expect, it } from "vitest"
import { niceTicks } from "./ticks"

describe("niceTicks", () => {
  it("covers the range with round steps", () => {
    expect(niceTicks(-443.8, 17.2)).toEqual([-600, -400, -200, 0, 200])
    expect(niceTicks(0, 631.7)).toEqual([0, 200, 400, 600, 800])
    expect(niceTicks(0, 7)).toEqual([0, 2, 4, 6, 8])
  })

  it("still returns an axis when everything is the same value", () => {
    expect(niceTicks(0, 0)).toEqual([-1, -0.5, 0, 0.5, 1])
  })
})
