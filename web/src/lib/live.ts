import { z } from "zod"
import type { Level } from "./ladder"

const decimal = z.string().regex(/^\d+(\.\d+)?$/)
const levelWire = z.tuple([decimal, z.number()])

const bookWire = z.object({
  bids: z.array(levelWire),
  asks: z.array(levelWire),
  messages: z.number(),
  msgs_per_sec: z.number(),
  p50_ns: z.number(),
  p99_ns: z.number(),
  gaps: z.number(),
  crossed_events: z.number(),
  levels: z.number(),
  uptime_s: z.number(),
  snapshots: z.number().default(0),
  age_ms: z.number().default(0),
})

const sampleWire = z.object({
  captured_at: z.string(),
  interval_s: z.number(),
  product: z.string(),
  frames: z.array(bookWire),
})

export type LiveStats = {
  messages: number
  msgsPerSec: number
  p50Ns: number
  p99Ns: number
  gaps: number
  crossedEvents: number
  levels: number
  snapshots: number
  uptimeS: number
  ageMs: number
}

export type LiveBook = { bids: Level[]; asks: Level[]; stats: LiveStats }
export type LiveSample = { capturedAt: string; intervalS: number; product: string; frames: LiveBook[] }

function fromWire(wire: z.infer<typeof bookWire>): LiveBook {
  const toLevel = ([price, size]: [string, number]): Level => ({ price: Number(price), size })
  return {
    bids: wire.bids.map(toLevel),
    asks: wire.asks.map(toLevel),
    stats: {
      messages: wire.messages,
      msgsPerSec: wire.msgs_per_sec,
      p50Ns: wire.p50_ns,
      p99Ns: wire.p99_ns,
      gaps: wire.gaps,
      crossedEvents: wire.crossed_events,
      levels: wire.levels,
      snapshots: wire.snapshots,
      uptimeS: wire.uptime_s,
      ageMs: wire.age_ms,
    },
  }
}

export function parseLiveBook(raw: unknown): LiveBook {
  return fromWire(bookWire.parse(raw))
}

export function parseLiveSample(raw: unknown): LiveSample {
  const wire = sampleWire.parse(raw)
  return {
    capturedAt: wire.captured_at,
    intervalS: wire.interval_s,
    product: wire.product,
    frames: wire.frames.map(fromWire),
  }
}

export function isStale(book: LiveBook, thresholdMs = 3000): boolean {
  return book.stats.ageMs > thresholdMs
}
