export function scaleBars(values: number[]): number[] {
  const max = Math.max(0, ...values)
  return values.map((v) => (max > 0 ? v / max : 0))
}

export const benchmark = {
  machine: "Apple M4, 10 cores, 16 GB, AC power",
  measuredOn: "19 Oct 2026",
  input: "first 60,054,539 messages of the 28 Nov 2025 NASDAQ ITCH file, held in memory",
  runs: 7,
  rows: [
    { label: "Parse only", median: 221, low: 122, high: 222, tone: "bid" },
    { label: "Parse and book update", median: 12.2, low: 11.4, high: 12.3, tone: "ask" },
    { label: "With prefetching", median: 15.8, low: 15.6, high: 15.8, tone: "ask" },
    { label: "Two-thread pipeline", median: 14.1, low: 12.8, high: 14.6, tone: "ask" },
  ],
  latencyNs: { p50: 57, p90: 125, p99: 590, p999: 1758 },
  fullDay: { messages: 353_357_889, seconds: 44.6 },
} as const
