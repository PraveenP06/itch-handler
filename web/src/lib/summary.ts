import { readFile } from "node:fs/promises"
import path from "node:path"
import { z } from "zod"

const summaryWire = z.object({
  messages: z.number(),
  live_orders_end: z.number(),
  book_errors: z.number(),
  by_type: z.record(z.string(), z.number()),
})

export type DaySummary = { messages: number; liveOrdersEnd: number; bookErrors: number; stocks: number }

export async function getDaySummary(): Promise<DaySummary> {
  "use cache"
  const file = path.join(process.cwd(), "public", "data", "itch-day.json")
  const wire = summaryWire.parse(JSON.parse(await readFile(file, "utf8")))
  return {
    messages: wire.messages,
    liveOrdersEnd: wire.live_orders_end,
    bookErrors: wire.book_errors,
    stocks: wire.by_type.directory ?? 0,
  }
}
