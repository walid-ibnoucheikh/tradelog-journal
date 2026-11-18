import { describe, expect, it } from "vitest"
import { computeStats, dayKey, hourOfDay, monthCalendar, type TradeLike } from "./stats"

// 14:30Z is 09:30 / 10:30 New York depending on daylight saving time.
function trade(day: string, netPnl: number, time = "15:00"): TradeLike {
  const closedAt = new Date(`${day}T${time}:00Z`)
  return { openedAt: new Date(closedAt.getTime() - 60_000), closedAt, netPnl }
}

describe("computeStats with an explicit status", () => {
  // Two real trades and a break-even that still gained a little after commissions.
  const stats = computeStats([
    { ...trade("2026-10-19", 300), status: "win" },
    { ...trade("2026-10-19", -100), status: "loss" },
    { ...trade("2026-10-19", 12), status: "be" },
    { ...trade("2026-10-20", -3), status: "be" },
  ])

  it("keeps break-even trades out of the win and loss counts and the win rate", () => {
    expect(stats).toMatchObject({ tradeCount: 4, wins: 1, losses: 1, breakeven: 2 })
    expect(stats.winRate).toBe(50)
    expect(stats.avgWin).toBe(300)
    expect(stats.avgLoss).toBe(100)
  })

  it("keeps their money in the totals and the profit factor", () => {
    expect(stats.netPnl).toBe(209)
    expect(stats.grossProfit).toBe(312)
    expect(stats.grossLoss).toBe(103)
    expect(stats.profitFactor).toBeCloseTo(312 / 103)
  })

  it("uses the same rule for each day's win rate", () => {
    expect(stats.days[0].winRate).toBe(50)
    expect(stats.days[1].winRate).toBeNull()
  })
})

describe("computeStats", () => {
  const stats = computeStats([
    trade("2026-10-15", 521.3),
    trade("2026-10-19", 300),
    trade("2026-10-19", -100),
    trade("2026-10-20", -200),
    trade("2026-10-21", 0),
  ])

  it("counts wins, losses and break-even trades; win rate ignores break-even", () => {
    expect(stats).toMatchObject({ tradeCount: 5, wins: 2, losses: 2, breakeven: 1 })
    expect(stats.winRate).toBe(50)
  })

  it("computes profit factor and average win/loss ratio", () => {
    expect(stats.grossProfit).toBe(821.3)
    expect(stats.grossLoss).toBe(300)
    expect(stats.profitFactor).toBeCloseTo(821.3 / 300)
    expect(stats.avgWin).toBeCloseTo(410.65)
    expect(stats.avgLoss).toBe(150)
    expect(stats.avgWinLossRatio).toBeCloseTo(410.65 / 150)
  })

  it("groups by trading day; day win rate ignores break-even days", () => {
    expect(stats.days.map((day) => [day.date, day.netPnl, day.trades])).toEqual([
      ["2026-10-15", 521.3, 1],
      ["2026-10-19", 200, 2],
      ["2026-10-20", -200, 1],
      ["2026-10-21", 0, 1],
    ])
    expect(stats.days[1].winRate).toBe(50)
    expect(stats).toMatchObject({ winningDays: 2, losingDays: 1, breakevenDays: 1 })
    expect(stats.dayWinRate).toBeCloseTo(66.67, 1)
  })

  it("builds the cumulative curve and drawdown from a peak of 0", () => {
    expect(stats.cumulative.map((point) => point.value)).toEqual([521.3, 721.3, 521.3, 521.3])
    expect(stats.drawdown.map((point) => point.value)).toEqual([0, 0, -200, -200])
    expect(stats.maxDrawdown).toBe(-200)
  })

  it("starts the drawdown peak at 0 when the first day loses", () => {
    expect(computeStats([trade("2026-10-15", -50)]).maxDrawdown).toBe(-50)
  })

  it("handles no trades and no losses without dividing by zero", () => {
    expect(computeStats([])).toMatchObject({
      tradeCount: 0,
      winRate: null,
      profitFactor: null,
      avgWinLossRatio: null,
      dayWinRate: null,
      maxDrawdown: 0,
    })
    expect(computeStats([trade("2026-10-15", 10)]).profitFactor).toBeNull()
  })
})

describe("time helpers", () => {
  // October 2026 is on EDT (UTC-4): 21:00Z is 17:00 in New York.
  it("uses the New York trading day, not UTC", () => {
    expect(dayKey(new Date("2026-10-15T14:30:00Z"))).toBe("2026-10-15") // 10:30
    expect(dayKey(new Date("2026-10-15T09:00:00Z"))).toBe("2026-10-15") // 05:00
  })

  it("rolls over at 18:00 New York time, like the futures session", () => {
    expect(dayKey(new Date("2026-10-14T21:59:00Z"))).toBe("2026-10-14") // 17:59
    expect(dayKey(new Date("2026-10-14T22:00:00Z"))).toBe("2026-10-15") // 18:00
    expect(dayKey(new Date("2026-10-15T03:00:00Z"))).toBe("2026-10-15") // 23:00 the day before
    expect(dayKey(new Date("2026-10-15T04:00:00Z"))).toBe("2026-10-15") // midnight
  })

  it("sends Sunday evening to Monday and a month-end evening to the next month", () => {
    expect(dayKey(new Date("2026-10-18T22:00:00Z"))).toBe("2026-10-19")
    expect(dayKey(new Date("2026-10-30T22:30:00Z"))).toBe("2026-10-31")
    expect(dayKey(new Date("2026-10-31T23:00:00Z"))).toBe("2026-11-01")
  })

  it("follows winter time too", () => {
    // January is on EST (UTC-5): 23:00Z is 18:00.
    expect(dayKey(new Date("2026-01-14T22:59:00Z"))).toBe("2026-01-14")
    expect(dayKey(new Date("2026-01-14T23:00:00Z"))).toBe("2026-01-15")
  })

  it("puts a trade closed at 20:37 on the 26th on the 27th, as Tradovate does", () => {
    const evening = {
      openedAt: new Date("2026-10-27T00:30:00Z"),
      closedAt: new Date("2026-10-27T00:37:00Z"),
      netPnl: -127.8,
    }
    const morning = {
      openedAt: new Date("2026-10-27T13:47:00Z"),
      closedAt: new Date("2026-10-27T13:49:00Z"),
      netPnl: 131.6,
    }
    expect(computeStats([evening, morning]).days).toMatchObject([
      { date: "2026-10-27", netPnl: 3.8, trades: 2 },
    ])
  })

  it("returns the New York hour as a decimal", () => {
    expect(hourOfDay(new Date("2026-10-15T13:30:00Z"))).toBe(9.5)
    expect(hourOfDay(new Date("2026-01-15T14:45:00Z"))).toBe(9.75)
  })
})

describe("monthCalendar", () => {
  const days = computeStats([
    trade("2026-10-15", 521.3),
    trade("2026-10-19", 300),
    trade("2026-10-19", -100),
  ]).days
  const weeks = monthCalendar(days, 2026, 10)

  it("lays out October 2026 Sunday first", () => {
    // 1 Oct 2026 is a Thursday.
    expect(weeks).toHaveLength(5)
    expect(weeks[0].days.map((cell) => cell?.day ?? null)).toEqual([
      null,
      null,
      null,
      null,
      1,
      2,
      3,
    ])
    expect(weeks[4].days.map((cell) => cell?.day ?? null)).toEqual([25, 26, 27, 28, 29, 30, 31])
  })

  it("attaches day stats and weekly totals", () => {
    const thursday = weeks[2].days[4]
    expect(thursday).toMatchObject({ day: 15, stat: { netPnl: 521.3, trades: 1 } })
    expect(weeks[2]).toMatchObject({ netPnl: 521.3, tradingDays: 1 })
    expect(weeks[3]).toMatchObject({ netPnl: 200, tradingDays: 1 })
    expect(weeks[0]).toMatchObject({ netPnl: 0, tradingDays: 0 })
  })
})
