export type Level = { price: number; size: number }
export type LadderRow = Level & { share: number }
export type LadderState = "ok" | "locked" | "crossed" | "one-sided" | "empty"

export type Ladder = {
  asks: LadderRow[]
  bids: LadderRow[]
  maxSize: number
  mid: number | null
  spread: number | null
  spreadBps: number | null
  state: LadderState
}

function stateOf(bids: Level[], asks: Level[]): LadderState {
  if (bids.length === 0 && asks.length === 0) return "empty"
  if (bids.length === 0 || asks.length === 0) return "one-sided"
  if (bids[0].price > asks[0].price) return "crossed"
  if (bids[0].price === asks[0].price) return "locked"
  return "ok"
}

export function buildLadder(bids: Level[], asks: Level[], depth: number): Ladder {
  const shownBids = bids.slice(0, depth)
  const shownAsks = asks.slice(0, depth)
  const maxSize = Math.max(0, ...shownBids.map((l) => l.size), ...shownAsks.map((l) => l.size))
  const row = (level: Level): LadderRow => ({ ...level, share: maxSize > 0 ? level.size / maxSize : 0 })
  const bothSides = shownBids.length > 0 && shownAsks.length > 0
  const mid = bothSides ? (shownBids[0].price + shownAsks[0].price) / 2 : null
  const spread = bothSides ? shownAsks[0].price - shownBids[0].price : null
  return {
    asks: shownAsks.map(row),
    bids: shownBids.map(row),
    maxSize,
    mid,
    spread,
    spreadBps: mid !== null && spread !== null && mid > 0 ? (spread / mid) * 10_000 : null,
    state: stateOf(shownBids, shownAsks),
  }
}
