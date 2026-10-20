const usd = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const int = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 })

export function formatClock(secondsSinceMidnight: number): string {
  const total = Math.floor(secondsSinceMidnight)
  const parts = [Math.floor(total / 3600), Math.floor((total % 3600) / 60), total % 60]
  return parts.map((p) => String(p).padStart(2, "0")).join(":")
}

export function formatUsd(value: number): string {
  return usd.format(value)
}

export function formatInt(value: number): string {
  return int.format(value)
}

export function formatBps(value: number): string {
  return `${value < 10 ? value.toFixed(2) : value.toFixed(1)} bps`
}

export function formatNs(ns: number): string {
  if (ns < 1_000) return `${Math.round(ns)} ns`
  if (ns < 1_000_000) return `${(ns / 1_000).toFixed(2)} µs`
  return `${(ns / 1_000_000).toFixed(2)} ms`
}
