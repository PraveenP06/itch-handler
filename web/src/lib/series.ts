type DomainOptions = { minSpan: number }

export function tightDomain(values: number[], { minSpan }: DomainOptions): [number, number] {
  if (values.length === 0) return [0, minSpan]
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const span = Math.max(hi - lo, minSpan)
  const margin = (span - (hi - lo)) / 2 + span * 0.1
  return [lo - margin, hi + margin]
}

export function pushWindow<T>(list: readonly T[], item: T, max: number): T[] {
  return [...list.slice(-(max - 1)), item]
}

export function firstQuotedIndex(mids: ReadonlyArray<number | null>): number {
  const index = mids.findIndex((m) => m !== null)
  return index === -1 ? 0 : index
}
