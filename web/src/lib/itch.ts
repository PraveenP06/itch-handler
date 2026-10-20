import { z } from "zod"
import type { Level } from "./ladder"

const PRICE_SCALE = 10_000
const OPEN_SECONDS = 34_200

const levelPair = z.tuple([z.number(), z.number()])
const snapshotWire = z.tuple([z.number(), z.array(levelPair), z.array(levelPair)])

const itchDayWire = z.object({
  messages: z.number(),
  live_orders_end: z.number(),
  book_errors: z.number(),
  by_type: z.record(z.string(), z.number()),
  per_minute: z.array(z.number()),
  symbols: z.record(z.string(), z.object({ locate: z.number(), snapshots: z.array(snapshotWire) })),
})

export type ItchSnapshot = { time: number; bids: Level[]; asks: Level[] }
export type ItchDay = {
  messages: number
  liveOrdersEnd: number
  bookErrors: number
  byType: Record<string, number>
  perMinute: number[]
  symbols: Record<string, { locate: number; snapshots: ItchSnapshot[] }>
}

const toLevels = (pairs: [number, number][]): Level[] =>
  pairs.map(([price, size]) => ({ price: price / PRICE_SCALE, size }))

export function parseItchDay(raw: unknown): ItchDay {
  const wire = itchDayWire.parse(raw)
  const symbols = Object.fromEntries(
    Object.entries(wire.symbols).map(([name, s]) => [
      name,
      {
        locate: s.locate,
        snapshots: s.snapshots.map(([time, bids, asks]) => ({ time, bids: toLevels(bids), asks: toLevels(asks) })),
      },
    ]),
  )
  return {
    messages: wire.messages,
    liveOrdersEnd: wire.live_orders_end,
    bookErrors: wire.book_errors,
    byType: wire.by_type,
    perMinute: wire.per_minute,
    symbols,
  }
}

export function midPrice(snapshot: ItchSnapshot): number | null {
  const bid = snapshot.bids[0]
  const ask = snapshot.asks[0]
  return bid && ask ? (bid.price + ask.price) / 2 : null
}

export function sessionOpenIndex(snapshots: ItchSnapshot[]): number {
  const index = snapshots.findIndex((s) => s.time >= OPEN_SECONDS)
  return index >= 0 ? index : 0
}

export type MixRow = { label: string; count: number; share: number }

export function messageMix(day: ItchDay): MixRow[] {
  const t = day.byType
  const get = (key: string) => t[key] ?? 0
  const rows: [string, number][] = [
    ["Add order", get("add")],
    ["Delete order", get("delete")],
    ["Replace order", get("replace")],
    ["Executed (a trade)", get("execute")],
    ["Partial cancel", get("cancel")],
    ["Other", get("ignored") + get("malformed") + get("system") + get("directory")],
  ]
  return rows.map(([label, count]) => ({ label, count, share: day.messages > 0 ? count / day.messages : 0 }))
}
