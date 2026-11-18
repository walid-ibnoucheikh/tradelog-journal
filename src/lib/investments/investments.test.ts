import { describe, expect, it } from "vitest"
import {
  STARTER_PROVIDERS,
  isIncome,
  parseAccountStatus,
  parseTransactionType,
  providerSuggestions,
  signedAmount,
} from "./investments"

describe("parseTransactionType / parseAccountStatus", () => {
  it("accept only known values", () => {
    expect(parseTransactionType("payout")).toBe("payout")
    expect(parseTransactionType("refund")).toBeNull()
    expect(parseTransactionType(null)).toBeNull()
    expect(parseAccountStatus("blown")).toBe("blown")
    expect(parseAccountStatus("funded")).toBeNull()
  })
})

describe("signedAmount", () => {
  it("counts payouts as income and everything else as a cost", () => {
    expect(isIncome("payout")).toBe(true)
    expect(isIncome("reset")).toBe(false)
    expect(signedAmount({ type: "payout", amount: 500 })).toBe(500)
    expect(signedAmount({ type: "evaluation", amount: 37.5 })).toBe(-37.5)
  })
})

describe("providerSuggestions", () => {
  it("lists the providers already used, most used first, one entry per provider", () => {
    expect(
      providerSuggestions([
        { type: "tools", firm: "TradingView" },
        { type: "education", firm: "Mentor" },
        { type: "tools", firm: "tradingview" },
        { type: "tools", firm: "Tradecopia" },
        { type: "education", firm: "Mentor" },
        { type: "tools", firm: "TradingView" },
      ])
    ).toEqual(["TradingView", "Mentor", "Tradecopia"])
  })

  it("ignores prop firms and the labels given to an empty provider", () => {
    expect(
      providerSuggestions([
        { type: "evaluation", firm: "Apex" },
        { type: "tools", firm: "Tools" },
        { type: "education", firm: "Education" },
        { type: "tools", firm: "  " },
      ])
    ).toEqual(STARTER_PROVIDERS)
  })

  it("falls back to the starter suggestions when nothing was entered yet", () => {
    expect(providerSuggestions([])).toEqual(["TradingView", "Tradecopia"])
  })
})
