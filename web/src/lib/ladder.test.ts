import { describe, expect, it } from "vitest"
import { buildLadder } from "./ladder"

const level = (price: number, size: number) => ({ price, size })

describe("buildLadder", () => {
  it("scales every bar against the largest size shown on either side", () => {
    const ladder = buildLadder([level(100, 5), level(99, 10)], [level(101, 20)], 10)
    expect(ladder.maxSize).toBe(20)
    expect(ladder.asks[0].share).toBe(1)
    expect(ladder.bids[0].share).toBe(0.25)
    expect(ladder.bids[1].share).toBe(0.5)
  })

  it("reports mid, spread and spread in basis points", () => {
    const ladder = buildLadder([level(99.99, 1)], [level(100.01, 1)], 10)
    expect(ladder.state).toBe("ok")
    expect(ladder.mid).toBeCloseTo(100, 6)
    expect(ladder.spread).toBeCloseTo(0.02, 6)
    expect(ladder.spreadBps).toBeCloseTo(2, 4)
  })

  it("limits the number of rows per side", () => {
    const many = Array.from({ length: 30 }, (_, i) => level(100 - i, 1))
    expect(buildLadder(many, [], 12).bids).toHaveLength(12)
  })

  it("flags locked, crossed and one-sided books", () => {
    expect(buildLadder([level(100, 1)], [level(100, 1)], 5).state).toBe("locked")
    expect(buildLadder([level(101, 1)], [level(100, 1)], 5).state).toBe("crossed")
    expect(buildLadder([level(100, 1)], [], 5).state).toBe("one-sided")
    expect(buildLadder([], [], 5).state).toBe("empty")
  })

  it("never divides by zero on an empty book", () => {
    const ladder = buildLadder([], [], 5)
    expect(ladder.maxSize).toBe(0)
    expect(ladder.mid).toBeNull()
    expect(ladder.spreadBps).toBeNull()
  })
})
