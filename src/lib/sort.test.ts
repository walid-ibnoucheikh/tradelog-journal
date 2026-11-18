import { describe, expect, it } from "vitest"
import { sortRows } from "./sort"

describe("sortRows", () => {
  const rows = [
    { name: "banane", n: 2 },
    { name: "Ananas", n: null },
    { name: "cerise", n: 10 },
  ]

  it("sorts numbers both ways and keeps empty values last", () => {
    expect(sortRows(rows, (r) => r.n, "asc").map((r) => r.n)).toEqual([2, 10, null])
    expect(sortRows(rows, (r) => r.n, "desc").map((r) => r.n)).toEqual([10, 2, null])
  })

  it("sorts text without caring about case", () => {
    expect(sortRows(rows, (r) => r.name, "asc").map((r) => r.name)).toEqual([
      "Ananas",
      "banane",
      "cerise",
    ])
  })

  it("does not change the list it receives", () => {
    const copy = [...rows]
    sortRows(rows, (r) => r.n, "desc")
    expect(rows).toEqual(copy)
  })
})
