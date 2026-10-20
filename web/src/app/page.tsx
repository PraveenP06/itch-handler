import { ArrowRight, Radio, Rewind } from "lucide-react"
import Link from "next/link"
import { BenchmarkPanel } from "@/components/benchmark-panel"
import { PipelineDiagram } from "@/components/pipeline-diagram"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatInt } from "@/lib/format"
import { getDaySummary } from "@/lib/summary"
import { cn } from "@/lib/utils"

const limits = [
  "The ITCH mode replays a recorded file. It is not connected to a live NASDAQ feed, which is a paid, licensed product.",
  "The live mode is Level 2 Bitcoin data from Coinbase, not order by order, so it is not the same data as the NASDAQ day.",
  "The reason the book update is the bottleneck is not profiled. Cache misses on the order table are the likely cause, based on the prefetch result.",
  "A handful of thinly traded stocks show a locked or crossed book at times. The cause has not been verified.",
  "AVX-512, rdtsc and CPU pinning are not used. The benchmark machine is Apple Silicon.",
]

export default async function Home() {
  const day = await getDaySummary()
  return (
    <div className="space-y-10">
      <section className="grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-end">
        <div className="space-y-5">
          <h1 className="text-4xl font-bold leading-[1.05] text-balance sm:text-5xl">One order book engine, a real NASDAQ day and a live market.</h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
            A C++20 handler rebuilds the full limit order book of {formatInt(day.stocks)} stocks from NASDAQ&apos;s raw ITCH 5.0 feed, one order at a time. The same style of engine runs live on Bitcoin.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/replay" className={cn(buttonVariants({ size: "lg" }))}>
              Replay the trading day <ArrowRight className="size-4" />
            </Link>
            <Link href="/live" className={cn(buttonVariants({ size: "lg", variant: "outline" }))}>
              Watch the live book
            </Link>
          </div>
        </div>
        <dl className="divide-y rounded-xl border bg-card">
          {[
            ["Messages replayed", formatInt(day.messages)],
            ["Book errors", formatInt(day.bookErrors)],
            ["Orders left at the close", formatInt(day.liveOrdersEnd)],
            ["Session", "28 Nov 2025"],
          ].map(([label, value]) => (
            <div key={label} className="flex items-baseline justify-between gap-4 px-4 py-3">
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="num text-lg font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <Card className="transition-shadow hover:shadow-md">
          <CardHeader>
            <Rewind className="size-5 text-bid" />
            <CardTitle className="text-xl">ITCH replay</CardTitle>
            <CardDescription>NASDAQ stocks, every individual order, a full session replayed from a recording.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>Pick AAPL, NVDA, TSLA or others, drag through the day and watch the book change. Binary data, Level 3.</p>
            <Link href="/replay" className={cn(buttonVariants({ variant: "outline" }))}>
              Open the replay
            </Link>
          </CardContent>
        </Card>
        <Card className="transition-shadow hover:shadow-md">
          <CardHeader>
            <Radio className="size-5 text-ask" />
            <CardTitle className="text-xl">Live book</CardTitle>
            <CardDescription>Bitcoin on Coinbase, rebuilt in real time by the C++ engine from the raw stream.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>Text feed, Level 2, with the engine&apos;s own message rate, processing time and gap counters.</p>
            <Link href="/live" className={cn(buttonVariants({ variant: "outline" }))}>
              Open the live book
            </Link>
          </CardContent>
        </Card>
      </section>

      <PipelineDiagram />
      <BenchmarkPanel />

      <Card>
        <CardHeader>
          <CardTitle>What this does not claim</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            {limits.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
