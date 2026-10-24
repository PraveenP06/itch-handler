import { readdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

const dir = path.join(import.meta.dirname, "..", "public", "data", "days")
const days = readdirSync(dir)
  .filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name))
  .map((name) => {
    const day = JSON.parse(readFileSync(path.join(dir, name), "utf8"))
    return { date: name.replace(".json", ""), messages: day.messages, book_errors: day.book_errors }
  })
  .sort((a, b) => a.date.localeCompare(b.date))

writeFileSync(path.join(dir, "index.json"), JSON.stringify({ days }, null, 2) + "\n")
console.log(`indexed ${days.length} day(s): ${days.map((d) => d.date).join(", ")}`)
