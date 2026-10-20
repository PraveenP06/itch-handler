import type { Metadata } from "next"
import { ReplayPanel } from "@/components/replay-panel"

export const metadata: Metadata = { title: "ITCH replay | Book Lab" }

export default function ReplayPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold sm:text-4xl">Replay a NASDAQ trading day</h1>
        <p className="max-w-2xl text-muted-foreground">
          Real order-by-order data from 28 Nov 2025. The engine rebuilt every stock&apos;s book from raw messages. Play, scrub, or click the price chart.
        </p>
      </header>
      <ReplayPanel />
    </div>
  )
}
