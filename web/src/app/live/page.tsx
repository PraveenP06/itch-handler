import type { Metadata } from "next"
import { LivePanel } from "@/components/live-panel"

export const metadata: Metadata = { title: "Live book | Book Lab" }

export default function LivePage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold sm:text-4xl">The live Bitcoin book</h1>
        <p className="max-w-2xl text-muted-foreground">
          Coinbase&apos;s feed arrives as text. A Python process holds the connection and a C++ engine parses every message and keeps the book.
        </p>
      </header>
      <LivePanel />
    </div>
  )
}
