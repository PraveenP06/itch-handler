import type { Metadata } from "next"
import { LivePanel } from "@/components/live-panel"

export const metadata: Metadata = { title: "Live book | Book Lab" }

export default function LivePage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold sm:text-4xl">Live Bitcoin</h1>
        <p className="max-w-2xl text-muted-foreground">Real Coinbase data, rebuilt by the C++ engine.</p>
      </header>
      <LivePanel />
    </div>
  )
}
