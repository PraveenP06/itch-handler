import type { Metadata } from "next"
import { ReplayPanel } from "@/components/replay-panel"

export const metadata: Metadata = { title: "ITCH replay | Book Lab" }

export default function ReplayPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold sm:text-4xl">Replay a NASDAQ day</h1>
        <p className="max-w-2xl text-muted-foreground">Pick a day and a stock, then press play. Every order, rebuilt by the engine.</p>
      </header>
      <ReplayPanel />
    </div>
  )
}
