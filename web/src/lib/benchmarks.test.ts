import { describe, expect, it } from "vitest"
import { benchmark, scaleBars } from "./benchmarks"

describe("scaleBars", () => {
  it("scales values so the largest fills the bar", () => {
    expect(scaleBars([221, 11, 110.5])).toEqual([1, 11 / 221, 0.5])
  })

  it("returns zeros when everything is zero", () => {
    expect(scaleBars([0, 0])).toEqual([0, 0])
  })
})

describe("benchmark data", () => {
  it("keeps every median inside its own measured range", () => {
    for (const row of benchmark.rows) {
      expect(row.low).toBeLessThanOrEqual(row.median)
      expect(row.median).toBeLessThanOrEqual(row.high)
    }
  })

  it("orders the latency percentiles", () => {
    const { p50, p90, p99, p999 } = benchmark.latencyNs
    expect([p50, p90, p99, p999]).toEqual([...[p50, p90, p99, p999]].sort((a, b) => a - b))
  })
})
