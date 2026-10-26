import { z } from "zod"

const dayWire = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  messages: z.number(),
  book_errors: z.number(),
})

const indexWire = z.object({ days: z.array(dayWire) })

export type DayEntry = { date: string; messages: number; bookErrors: number }

export function parseDayIndex(raw: unknown): DayEntry[] {
  return indexWire
    .parse(raw)
    .days.map((d) => ({ date: d.date, messages: d.messages, bookErrors: d.book_errors }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

export function dayLabel(date: string): string {
  const [year, month, day] = date.split("-").map(Number)
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  return `${WEEKDAYS[weekday]} ${day} ${MONTHS[month - 1]} ${year}`
}
