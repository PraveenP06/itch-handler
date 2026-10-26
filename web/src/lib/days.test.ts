import { describe, expect, it } from "vitest"
import { dayLabel, parseDayIndex } from "./days"

describe("parseDayIndex", () => {
  it("returns the days oldest first", () => {
    const days = parseDayIndex({ days: [{ date: "2025-12-09", messages: 2, book_errors: 0 }, { date: "2025-11-28", messages: 1, book_errors: 0 }] })
    expect(days.map((d) => d.date)).toEqual(["2025-11-28", "2025-12-09"])
  })

  it("rejects a malformed index instead of showing garbage", () => {
    expect(() => parseDayIndex({ days: [{ date: "yesterday" }] })).toThrow()
  })
})

describe("dayLabel", () => {
  it("shows weekday, date and year without shifting for time zones", () => {
    expect(dayLabel("2025-12-08")).toBe("Mon 8 Dec 2025")
    expect(dayLabel("2025-11-28")).toBe("Fri 28 Nov 2025")
  })
})
