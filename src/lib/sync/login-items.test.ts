import { describe, expect, it } from "vitest"
import { loginItems, loginTitle } from "./login-items"

const account = (
  name: string,
  firm: string,
  loginKey: string | null = null,
  status = "active"
) => ({
  name,
  firm,
  status,
  loginKey,
})

describe("loginItems", () => {
  it("lists the logins the active accounts need, with who uses them", () => {
    const items = loginItems(
      [
        account("Apex #1", "Apex"),
        account("Apex #2", "apex "),
        account("Apex #3", "Apex", "apex:1a2b3c4d"),
        account("Lucid #1", "Lucid"),
      ],
      [
        { key: "lucid", firm: "Lucid", label: null },
        { key: "apex:1a2b3c4d", firm: "Apex", label: "login 2" },
      ]
    )
    expect(items.map((item) => [loginTitle(item), item.saved, item.accounts])).toEqual([
      ["Apex", false, ["Apex #1", "Apex #2"]],
      ["Apex · login 2", true, ["Apex #3"]],
      ["Lucid", true, ["Lucid #1"]],
    ])
  })

  it("ignores ended accounts but keeps a saved login nobody uses", () => {
    const items = loginItems(
      [account("Old", "Topstep", null, "blown")],
      [{ key: "topstep", firm: "Topstep", label: null }]
    )
    expect(items).toEqual([
      { key: "topstep", firm: "Topstep", label: null, saved: true, accounts: [] },
    ])
  })

  it("keeps two logins of one firm apart", () => {
    const items = loginItems(
      [account("A", "Apex", "apex:11111111"), account("B", "Apex", "apex:22222222")],
      []
    )
    expect(items.map((item) => item.key)).toEqual(["apex:11111111", "apex:22222222"])
  })
})
