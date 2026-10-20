import { describe, expect, it } from "vitest"
import { formatBps, formatClock, formatInt, formatNs, formatUsd } from "./format"

describe("formatClock", () => {
  it("renders seconds since midnight as HH:MM:SS", () => {
    expect(formatClock(34200)).toBe("09:30:00")
    expect(formatClock(0)).toBe("00:00:00")
    expect(formatClock(61505)).toBe("17:05:05")
  })
})

describe("formatUsd", () => {
  it("uses thousands separators and two decimals", () => {
    expect(formatUsd(81786.8)).toBe("81,786.80")
    expect(formatUsd(276.2)).toBe("276.20")
  })
})

describe("formatInt", () => {
  it("groups digits", () => {
    expect(formatInt(353357889)).toBe("353,357,889")
  })
})

describe("formatBps", () => {
  it("shows two decimals below 10 bps and one above", () => {
    expect(formatBps(0.0123)).toBe("0.01 bps")
    expect(formatBps(12.34)).toBe("12.3 bps")
  })
})

describe("formatNs", () => {
  it("scales nanoseconds into readable units", () => {
    expect(formatNs(57)).toBe("57 ns")
    expect(formatNs(1758)).toBe("1.76 µs")
    expect(formatNs(2_500_000)).toBe("2.50 ms")
  })
})
