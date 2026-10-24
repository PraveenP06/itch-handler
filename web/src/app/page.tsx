import { ArrowRight, Radio, Rewind } from "lucide-react"
import Link from "next/link"
import { BenchmarkPanel } from "@/components/benchmark-panel"
import { PipelineDiagram } from "@/components/pipeline-diagram"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { benchmark } from "@/lib/benchmarks"
import { formatInt } from "@/lib/format"
import { getDaySummary } from "@/lib/summary"
import { cn } from "@/lib/utils"

const ideas = [
  {
    title: "What is an order book?",
    body: "A live list of everyone's offers. Buyers post the price they will pay, sellers post the price they will accept. The gap between the best two is the spread.",
  },
  {
    title: "What is ITCH?",
    body: "NASDAQ's raw data feed. Every order placed, changed, cancelled or filled becomes one tiny message. Replay them in order and you can rebuild the book at any moment of the day.",
  },
  {
    title: "What is the goal?",
    body: "Rebuild the book correctly and fast. This engine does a whole trading day with no mistakes, then runs the same idea live on Bitcoin.",
  },
]

const uses = [
  {
    title: "Know what a trade will really cost",
    body: "The book shows the spread and how much is on offer at each price. A big order eats through the levels, so the depth chart tells you the price you would actually get.",
    href: "/live",
    link: "See the depth chart",
  },
  {
    title: "Test trading ideas on real history",
    body: "Replay a real day and ask what your order would have done. My earlier simulator did this with crypto fees: at a 0.90% taker fee a round trip costs about 180 bps, while typical price moves were about 1 bp. That is why my arbitrage bots lost.",
    href: "/replay",
    link: "Replay a day",
  },
  {
    title: "Trust the picture",
    body: "A trading system is only as good as its view of the market. A wrong book means wrong decisions, so the engine counts every error and every gap in the feed. Here that is 0 errors over 353 million messages.",
    href: "/live",
    link: "See the live counters",
  },
  {
    title: "Keep up with the market",
    body: "At the open, millions of messages arrive in minutes. A slow engine falls behind and shows old prices. This one takes about 57 nanoseconds per message at the median.",
    href: "/live",
    link: "Watch the engine's timing",
  },
]

const limits = [
  "The NASDAQ replay is a recorded day, not a live feed. NASDAQ's live feed is a paid, licensed product.",
  "The live page is Bitcoin from Coinbase. It is a different, simpler kind of data than NASDAQ's.",
  "Why the book update is the slowest stage has not been profiled. Cache misses are the likely cause.",
  "A few thinly traded stocks show a locked or crossed book at times. The cause has not been verified.",
]

export default async function Home() {
  const day = await getDaySummary()
  const facts = [
    { value: formatInt(day.messages), label: "NASDAQ messages replayed" },
    { value: formatInt(day.bookErrors), label: "book errors" },
    { value: `${benchmark.fullDay.seconds} s`, label: "for the whole day on one laptop" },
  ]
  return (
    <div className="space-y-12">
      <section className="space-y-6">
        <h1 className="max-w-3xl text-4xl font-bold leading-[1.05] text-balance sm:text-5xl">Watch an exchange&apos;s order book get rebuilt, one message at a time.</h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          A C++ program reads the raw messages a stock exchange sends and rebuilds who is offering to buy and sell, at what price. Replay a real NASDAQ day, or watch it run live on Bitcoin.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/replay" className={cn(buttonVariants({ size: "lg" }))}>
            Replay a trading day <ArrowRight className="size-4" />
          </Link>
          <Link href="/live" className={cn(buttonVariants({ size: "lg", variant: "outline" }))}>
            Watch Bitcoin live
          </Link>
        </div>
        <dl className="grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-3">
          {facts.map((f) => (
            <div key={f.label} className="bg-card px-4 py-4">
              <dd className="num text-2xl font-medium">{f.value}</dd>
              <dt className="text-sm text-muted-foreground">{f.label}</dt>
            </div>
          ))}
        </dl>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {ideas.map((idea) => (
          <div key={idea.title} className="space-y-2">
            <h2 className="text-lg font-semibold">{idea.title}</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{idea.body}</p>
          </div>
        ))}
      </section>

      <section className="space-y-5 rounded-2xl border border-bid/40 bg-card p-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold">How is this useful?</h2>
          <p className="max-w-2xl text-muted-foreground">Every trading program needs to know what is on offer right now. This is the part that keeps that picture right, and fast.</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          {uses.map((u) => (
            <div key={u.title} className="space-y-2">
              <h3 className="font-semibold">{u.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{u.body}</p>
              <Link href={u.href} className="inline-flex items-center gap-1 text-sm font-medium text-bid hover:underline">
                {u.link} <ArrowRight className="size-3.5" />
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <Card className="transition-shadow hover:shadow-md">
          <CardHeader>
            <Rewind className="size-5 text-bid" />
            <CardTitle className="text-xl">NASDAQ replay</CardTitle>
            <CardDescription>A real trading day, order by order. Pick a stock and watch its book move from the open.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/replay" className={cn(buttonVariants({ variant: "outline" }))}>
              Open the replay
            </Link>
          </CardContent>
        </Card>
        <Card className="transition-shadow hover:shadow-md">
          <CardHeader>
            <Radio className="size-5 text-ask" />
            <CardTitle className="text-xl">Live Bitcoin</CardTitle>
            <CardDescription>The same kind of engine, running right now on a server, with a live book, trades and its own timings.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/live" className={cn(buttonVariants({ variant: "outline" }))}>
              Open the live book
            </Link>
          </CardContent>
        </Card>
      </section>

      <details className="rounded-xl border p-4">
        <summary className="cursor-pointer text-lg font-semibold">For engineers: how it is built and how fast</summary>
        <div className="space-y-6 pt-4">
          <PipelineDiagram />
          <BenchmarkPanel />
        </div>
      </details>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">What this does not claim</h2>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
          {limits.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </section>
    </div>
  )
}
