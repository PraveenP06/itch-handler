import { describe, expect, it } from "vitest"
import { dayChange, messageMix, midPrice, parseItchDay, sessionOpenIndex } from "./itch"

const raw = {
  messages: 1000,
  live_orders_end: 0,
  book_errors: 0,
  by_type: { ignored: 10, malformed: 0, system: 1, directory: 4, add: 500, execute: 25, cancel: 60, delete: 300, replace: 100 },
  per_minute: [5, 10, 20],
  symbols: {
    AAPL: {
      locate: 24,
      snapshots: [
        [34170, [[2762300, 58]], [[2762700, 123]]],
        [34200, [[2762200, 10]], []],
      ],
    },
  },
}

describe("parseItchDay", () => {
  it("converts integer prices to dollars and exposes typed snapshots", () => {
    const day = parseItchDay(raw)
    const first = day.symbols.AAPL.snapshots[0]
    expect(first.time).toBe(34170)
    expect(first.bids[0]).toEqual({ price: 276.23, size: 58 })
    expect(first.asks[0]).toEqual({ price: 276.27, size: 123 })
    expect(day.messages).toBe(1000)
    expect(day.bookErrors).toBe(0)
    expect(day.liveOrdersEnd).toBe(0)
  })

  it("rejects data that does not match the expected shape", () => {
    expect(() => parseItchDay({ messages: "many" })).toThrow()
    expect(() => parseItchDay(null)).toThrow()
  })
})

describe("midPrice", () => {
  it("is the middle of the best bid and ask, or null when a side is empty", () => {
    const day = parseItchDay(raw)
    const [two, one] = day.symbols.AAPL.snapshots
    expect(midPrice(two)).toBeCloseTo(276.25, 6)
    expect(midPrice(one)).toBeNull()
  })
})

describe("sessionOpenIndex", () => {
  it("finds the first snapshot at or after the 9:30 open", () => {
    const day = parseItchDay(raw)
    expect(sessionOpenIndex(day.symbols.AAPL.snapshots)).toBe(1)
  })

  it("falls back to the start when the day has no open", () => {
    expect(sessionOpenIndex([])).toBe(0)
  })
})

describe("messageMix", () => {
  it("returns each message kind with its share of the day, grouping the minor kinds", () => {
    const mix = messageMix(parseItchDay(raw))
    const add = mix.find((m) => m.label === "Add order")
    expect(add).toEqual({ label: "Add order", count: 500, share: 0.5 })
    const other = mix.find((m) => m.label === "Other")
    expect(other?.count).toBe(15)
    expect(mix.reduce((sum, m) => sum + m.count, 0)).toBe(1000)
  })
})

describe("dayChange", () => {
  const snap = (time: number, bid: number, ask: number) => ({ time, bids: [{ price: bid, size: 1 }], asks: [{ price: ask, size: 1 }] })

  it("compares the mid at the 9:30 open with the last mid before the 4pm close", () => {
    const change = dayChange([snap(30000, 90, 92), snap(34200, 99, 101), snap(57600, 109, 111), snap(61200, 150, 152)])
    expect(change).toEqual({ open: 100, close: 110, pct: 10 })
  })

  it("is null when the stock never quoted during the session", () => {
    expect(dayChange([{ time: 34200, bids: [], asks: [] }])).toBeNull()
  })
})
