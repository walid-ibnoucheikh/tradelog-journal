import { describe, expect, it } from "vitest"
import { sampleEvenly } from "./sample"

const numbers = (count: number) => Array.from({ length: count }, (_, index) => index)

describe("sampleEvenly", () => {
  it("keeps a short list as it is", () => {
    expect(sampleEvenly(numbers(5), 10)).toEqual(numbers(5))
    expect(sampleEvenly([], 10)).toEqual([])
  })

  it("keeps the first and the last item and spreads the others", () => {
    const sample = sampleEvenly(numbers(10_001), 5)
    expect(sample).toEqual([0, 2500, 5000, 7500, 10000])
  })

  it("never returns more than the maximum, without duplicates for a longer list", () => {
    const sample = sampleEvenly(numbers(24_000), 1_500)
    expect(sample).toHaveLength(1_500)
    expect(sample[0]).toBe(0)
    expect(sample[sample.length - 1]).toBe(23_999)
    expect(new Set(sample).size).toBe(1_500)
  })
})
