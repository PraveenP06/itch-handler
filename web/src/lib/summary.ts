import { readFile } from "node:fs/promises"
import path from "node:path"
import { parseDayIndex } from "./days"

export type DaySummary = { messages: number; bookErrors: number; days: number }

export async function getDaySummary(): Promise<DaySummary> {
  "use cache"
  const file = path.join(process.cwd(), "public", "data", "days", "index.json")
  const days = parseDayIndex(JSON.parse(await readFile(file, "utf8")))
  return {
    messages: days.reduce((sum, d) => sum + d.messages, 0),
    bookErrors: days.reduce((sum, d) => sum + d.bookErrors, 0),
    days: days.length,
  }
}
