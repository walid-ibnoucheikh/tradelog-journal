import { describe, expect, it } from "vitest"
import { readLogin } from "./login-input"

describe("readLogin", () => {
  it("is nothing when both fields are empty", () => {
    expect(readLogin("", "")).toEqual({ none: true })
  })

  it("is a login when both are given, spaces in a password kept", () => {
    expect(readLogin("walid", " a b ")).toEqual({ login: { username: "walid", password: " a b " } })
  })

  it("asks for the other field when only one is given", () => {
    expect(readLogin("walid", "")).toHaveProperty("error")
    expect(readLogin("", "secret")).toHaveProperty("error")
  })

  it("refuses absurdly long values", () => {
    expect(readLogin("a".repeat(201), "x")).toHaveProperty("error")
  })
})
