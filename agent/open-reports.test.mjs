import { describe, expect, it } from "vitest"
import { openReports } from "./tradovate.mjs"

/**
 * A fake Tradovate menu: the gear only exists on the selected account, a click on a line selects
 * it and closes the menu, and the gear opens the reports.
 */
function fakeTradovate({ active, accounts }) {
  const state = { active, menuOpen: false, reportsOpen: false, clicks: [] }
  const itemFor = (name) => ({
    isVisible: async () => state.menuOpen,
    count: async () => (accounts.includes(name) ? 1 : 0),
    hover: async () => {},
    click: async () => {
      state.clicks.push(`select:${name}`)
      state.active = name
      state.menuOpen = false
    },
    locator: () => ({
      waitFor: async ({ timeout }) => {
        if (state.active !== name || !state.menuOpen) throw new Error(`timeout ${timeout}`)
      },
      click: async ({ timeout }) => {
        if (state.active !== name || !state.menuOpen) throw new Error(`timeout ${timeout}`)
        state.clicks.push(`gear:${name}`)
        state.reportsOpen = true
        state.menuOpen = false
      },
    }),
  })
  const page = {
    locator: (selector) => {
      const account = selector.match(/account-item-(.+)"\]$/)?.[1]
      if (account) return itemFor(account)
      if (selector === "button.close") return { first: () => ({ isVisible: async () => false }) }
      if (selector === ".account-selector li") {
        return { first: () => ({ waitFor: async () => {} }) }
      }
      if (selector === "ul.nav-tabs") {
        return {
          waitFor: async () => {
            if (!state.reportsOpen) throw new Error("no reports")
          },
        }
      }
      // The account selector button in the header.
      return {
        first: () => ({
          click: async () => {
            state.menuOpen = !state.menuOpen
          },
        }),
      }
    },
  }
  return { page, state }
}

describe("openReports", () => {
  it("clicks the gear straight away on the selected account", async () => {
    const { page, state } = fakeTradovate({ active: "A", accounts: ["A", "B"] })
    await openReports(page, "A")
    expect(state.clicks).toEqual(["gear:A"])
  })

  it("selects an account first when it has no gear, then reopens the menu", async () => {
    const { page, state } = fakeTradovate({ active: "A", accounts: ["A", "B"] })
    await openReports(page, "B")
    expect(state.clicks).toEqual(["select:B", "gear:B"])
  })

  it("still reports an account that is not in the login", async () => {
    const { page } = fakeTradovate({ active: "A", accounts: ["A"] })
    await expect(openReports(page, "Z")).rejects.toThrow("not in this Tradovate login")
  })
})
