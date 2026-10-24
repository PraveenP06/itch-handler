import { describe, expect, it } from "vitest"
import { buildLadder, cumulativeDepth, diffLevels } from "./ladder"

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

describe("diffLevels", () => {
  it("marks a price whose size grew", () => {
    const flashes = diffLevels([{ price: 10, size: 1 }], [{ price: 10, size: 2 }])
    expect(flashes.get(10)).toBe("grew")
  })

  it("marks a price whose size shrank", () => {
    expect(diffLevels([{ price: 10, size: 2 }], [{ price: 10, size: 1 }]).get(10)).toBe("shrank")
  })

  it("marks a new price as grown", () => {
    expect(diffLevels([], [{ price: 11, size: 1 }]).get(11)).toBe("grew")
  })

  it("leaves unchanged prices alone", () => {
    expect(diffLevels([{ price: 10, size: 1 }], [{ price: 10, size: 1 }]).size).toBe(0)
  })
})

describe("cumulativeDepth", () => {
  it("adds up size from the best price outward, with bids listed lowest price first", () => {
    const depth = cumulativeDepth(
      [{ price: 9, size: 1 }, { price: 8, size: 2 }],
      [{ price: 10, size: 3 }, { price: 11, size: 4 }],
    )
    expect(depth.bids.map((p) => p.total)).toEqual([3, 1])
    expect(depth.asks.map((p) => p.total)).toEqual([3, 7])
  })

  it("orders bids from the lowest price up so the chart reads left to right", () => {
    const depth = cumulativeDepth([{ price: 9, size: 1 }, { price: 8, size: 2 }], [])
    expect(depth.bids.map((p) => p.price)).toEqual([8, 9])
  })
})
