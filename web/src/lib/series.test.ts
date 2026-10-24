import { describe, expect, it } from "vitest"
import { firstQuotedIndex, pushWindow, tightDomain } from "./series"

describe("tightDomain", () => {
  it("wraps the values with a margin so a flat line is not pinned to the axis", () => {
    const [lo, hi] = tightDomain([100.1, 100.3], { minSpan: 0.5 })
    expect(lo).toBeLessThan(100.1)
    expect(hi).toBeGreaterThan(100.3)
  })

  it("never shows less than the minimum span, so cent-sized moves do not look like crashes", () => {
    const [lo, hi] = tightDomain([80209.49, 80209.49], { minSpan: 2 })
    expect(hi - lo).toBeGreaterThanOrEqual(2)
  })

  it("keeps the values centred when padding to the minimum span", () => {
    const [lo, hi] = tightDomain([50, 50], { minSpan: 4 })
    expect((lo + hi) / 2).toBe(50)
  })

  it("returns a usable default for an empty series", () => {
    const [lo, hi] = tightDomain([], { minSpan: 1 })
    expect(hi).toBeGreaterThan(lo)
  })
})

describe("pushWindow", () => {
  it("appends and drops the oldest once the window is full", () => {
    expect(pushWindow([1, 2, 3], 4, 3)).toEqual([2, 3, 4])
  })

  it("does not change the original list", () => {
    const original = [1, 2]
    pushWindow(original, 3, 5)
    expect(original).toEqual([1, 2])
  })
})

describe("firstQuotedIndex", () => {
  it("skips the empty snapshots before the first quote", () => {
    expect(firstQuotedIndex([null, null, 10, 11])).toBe(2)
  })

  it("is zero when the series has no quotes at all", () => {
    expect(firstQuotedIndex([null, null])).toBe(0)
  })
})
