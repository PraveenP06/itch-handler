import { describe, expect, it } from "vitest"
import { countAt } from "./count"

describe("countAt", () => {
  it("starts at zero and ends exactly on the target", () => {
    expect(countAt({ target: 353, progress: 0 })).toBe(0)
    expect(countAt({ target: 353, progress: 1 })).toBe(353)
  })

  it("moves fastest at the start and slows toward the end", () => {
    const early = countAt({ target: 100, progress: 0.25 })
    const late = countAt({ target: 100, progress: 0.75 }) - countAt({ target: 100, progress: 0.5 })
    expect(early).toBeGreaterThan(late)
  })

  it("never overshoots when progress runs past the end", () => {
    expect(countAt({ target: 50, progress: 1.4 })).toBe(50)
  })
})
