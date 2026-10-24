import { z } from "zod"

export type Trade = { id: string; price: number; size: number; side: "buy" | "sell"; at: number }

const tradeWire = z.object({
  trade_id: z.string(),
  price: z.string(),
  size: z.string(),
  side: z.enum(["BUY", "SELL"]),
  time: z.string(),
})

const messageWire = z.object({
  channel: z.literal("market_trades"),
  events: z.array(z.object({ trades: z.array(z.unknown()).default([]) })),
})

function toTrade(wire: z.infer<typeof tradeWire>): Trade {
  return {
    id: wire.trade_id,
    price: Number(wire.price),
    size: Number(wire.size),
    side: wire.side === "BUY" ? "buy" : "sell",
    at: Date.parse(wire.time),
  }
}

export function parseTradeMessage(raw: unknown): Trade[] {
  const message = messageWire.safeParse(raw)
  if (!message.success) return []
  return message.data.events
    .flatMap((event) => event.trades)
    .flatMap((candidate) => {
      const parsed = tradeWire.safeParse(candidate)
      return parsed.success ? [toTrade(parsed.data)] : []
    })
}

export function mergeTrades(existing: readonly Trade[], incoming: readonly Trade[], max: number): Trade[] {
  const seen = new Set(existing.map((t) => t.id))
  const fresh = incoming.filter((t) => !seen.has(t.id))
  return [...[...fresh].sort((a, b) => b.at - a.at), ...existing].slice(0, max)
}

export function buyShare(trades: readonly Trade[]): number {
  const total = trades.reduce((sum, t) => sum + t.size, 0)
  if (total === 0) return 0.5
  return trades.filter((t) => t.side === "buy").reduce((sum, t) => sum + t.size, 0) / total
}
