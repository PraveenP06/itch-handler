import { describe, expect, it } from "vitest"
import { isStale, parseLiveBook, parseLiveSample } from "./live"

const wire = {
  bids: [["81786.80", 0.0214], ["81782.97", 0.0976]],
  asks: [["81786.81", 0.026]],
  messages: 258,
  updates: 5000,
  snapshots: 1,
  gaps: 0,
  crossed_events: 0,
  last_sequence: 99,
  levels: 41107,
  p50_ns: 19834,
  p99_ns: 97330,
  msgs_per_sec: 23,
  uptime_s: 15.4,
  age_ms: 18,
}

describe("parseLiveBook", () => {
  it("turns price strings into numbers and renames stats", () => {
    const book = parseLiveBook(wire)
    expect(book.bids[0]).toEqual({ price: 81786.8, size: 0.0214 })
    expect(book.asks[0]).toEqual({ price: 81786.81, size: 0.026 })
    expect(book.stats.msgsPerSec).toBe(23)
    expect(book.stats.p50Ns).toBe(19834)
    expect(book.stats.crossedEvents).toBe(0)
    expect(book.stats.ageMs).toBe(18)
  })

  it("rejects malformed responses instead of rendering garbage", () => {
    expect(() => parseLiveBook({ bids: "no" })).toThrow()
    expect(() => parseLiveBook([["1", 2]])).toThrow()
  })

  it("rejects prices that are not numbers", () => {
    expect(() => parseLiveBook({ ...wire, bids: [["abc", 1]] })).toThrow()
  })
})

describe("isStale", () => {
  it("treats a feed with an old last message as stale", () => {
    expect(isStale(parseLiveBook({ ...wire, age_ms: 500 }))).toBe(false)
    expect(isStale(parseLiveBook({ ...wire, age_ms: 5000 }))).toBe(true)
  })
})

describe("parseLiveSample", () => {
  it("reads a recorded session of engine frames", () => {
    const sample = parseLiveSample({
      captured_at: "2026-10-19T23:48:00Z",
      interval_s: 0.25,
      product: "BTC-USD",
      frames: [
        { t: 0, bids: [["100.00", 1]], asks: [["100.01", 2]], messages: 5, msgs_per_sec: 20, p50_ns: 900, p99_ns: 4000, gaps: 0, crossed_events: 0, levels: 10, uptime_s: 1 },
      ],
    })
    expect(sample.intervalS).toBe(0.25)
    expect(sample.frames).toHaveLength(1)
    expect(sample.frames[0].bids[0].price).toBe(100)
    expect(sample.frames[0].stats.p50Ns).toBe(900)
  })
})
