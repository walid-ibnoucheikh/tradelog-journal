import { describe, expect, it } from "vitest"
import { formValues } from "./form"

describe("formValues", () => {
  it("keeps text fields and drops files", () => {
    const data = new FormData()
    data.set("name", "Apex 50K")
    data.set("amount", "37.5")
    data.set("file", new Blob(["x"]), "x.csv")
    expect(formValues(data)).toEqual({ name: "Apex 50K", amount: "37.5" })
  })
})
