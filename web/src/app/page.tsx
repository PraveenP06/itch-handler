import { ArrowRight, FlaskConical, Gauge, Scale, ShieldCheck, Timer, Zap } from "lucide-react"
import Link from "next/link"
import { BenchmarkPanel } from "@/components/benchmark-panel"
import { CountUp } from "@/components/count-up"
import { FlowDiagram } from "@/components/flow-diagram"
import { HeroBook } from "@/components/hero-book"
import { buttonVariants } from "@/components/ui/button"
import { benchmark } from "@/lib/benchmarks"
import { getDaySummary } from "@/lib/summary"
import { cn } from "@/lib/utils"

const buildUses = (day: { messages: number }) => [
  { icon: Scale, title: "Know the real price", line: "Depth shows what a big order would actually pay.", href: "/live", tone: "bid" },
  { icon: FlaskConical, title: "Test ideas on real history", line: "My simulator showed fees ate 180 times a typical price move.", href: "/replay", tone: "ask" },
  { icon: ShieldCheck, title: "Trust the picture", line: `Zero errors across ${(day.messages / 1e9).toFixed(1)} billion messages.`, href: "/replay", tone: "ok" },
  { icon: Gauge, title: "Keep up at the open", line: "About 57 nanoseconds per message.", href: "/live", tone: "bid" },
] as const

const limits = [
  "The NASDAQ replay is a recorded day, not a live feed. NASDAQ's live feed is a paid, licensed product.",
  "The live page is Bitcoin from Coinbase, a simpler kind of data than NASDAQ's.",
  "Why the book update is the slowest stage has not been profiled. Cache misses are the likely cause.",
  "A few thinly traded stocks show a locked or crossed book at times. The cause has not been verified.",
]

const toneClasses = {
  bid: "bg-bid/15 text-bid",
  ask: "bg-ask/15 text-ask",
  ok: "bg-ok/15 text-ok",
} as const

export default async function Home() {
  const day = await getDaySummary()
  const uses = buildUses(day)
  const facts = [
    { icon: Zap, tone: "bid", value: day.messages, suffix: "", decimals: 0, label: `NASDAQ messages, ${day.days} trading days` },
    { icon: ShieldCheck, tone: "ok", value: day.bookErrors, suffix: "", decimals: 0, label: "book errors in total" },
    { icon: Timer, tone: "ask", value: benchmark.fullDay.seconds, suffix: " s", decimals: 1, label: "for one full day, one laptop" },
    { icon: Gauge, tone: "bid", value: benchmark.latencyNs.p50, suffix: " ns", decimals: 0, label: "typical time per message" },
  ] as const
  return (
    <div className="space-y-14">
      <section className="grid items-center gap-10 lg:grid-cols-[1.15fr_1fr]">
        <div className="space-y-6">
          <h1 className="text-5xl font-bold leading-[1.02] text-balance sm:text-6xl">Watch an order book rebuild itself.</h1>
          <p className="max-w-lg text-lg text-muted-foreground">A C++ engine rebuilds a stock exchange&apos;s book from raw messages. Replay a real NASDAQ day, or watch it live on Bitcoin.</p>
          <div className="flex flex-wrap gap-3">
            <Link href="/replay" className={cn(buttonVariants({ size: "lg" }), "shadow-[0_0_30px_-8px_var(--bid)]")}>
              Replay NASDAQ <ArrowRight className="size-4" />
            </Link>
            <Link href="/live" className={cn(buttonVariants({ size: "lg", variant: "outline" }))}>
              Watch Bitcoin live
            </Link>
          </div>
        </div>
        <HeroBook />
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {facts.map((f) => (
          <div key={f.label} className="space-y-2 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <span className={cn("inline-flex size-9 items-center justify-center rounded-lg", toneClasses[f.tone])}>
              <f.icon className="size-4.5" />
            </span>
            <p className="text-2xl font-medium sm:text-3xl">
              <CountUp value={f.value} decimals={f.decimals} suffix={f.suffix} />
            </p>
            <p className="text-sm text-muted-foreground">{f.label}</p>
          </div>
        ))}
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold">How it works</h2>
        <FlowDiagram />
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold">Why it is useful</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {uses.map((u) => (
            <Link key={u.title} href={u.href} className="group space-y-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 transition hover:-translate-y-0.5 hover:ring-foreground/30 motion-reduce:transition-none motion-reduce:hover:translate-y-0">
              <span className={cn("inline-flex size-10 items-center justify-center rounded-lg", toneClasses[u.tone])}>
                <u.icon className="size-5" />
              </span>
              <h3 className="font-semibold">{u.title}</h3>
              <p className="text-sm text-muted-foreground">{u.line}</p>
              <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1 motion-reduce:transition-none" />
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <details className="rounded-xl border p-4">
          <summary className="cursor-pointer font-semibold">For engineers: how it is built and how fast</summary>
          <div className="space-y-6 pt-4">
            <BenchmarkPanel />
          </div>
        </details>
        <details className="rounded-xl border p-4">
          <summary className="cursor-pointer font-semibold">What this does not claim</summary>
          <ul className="list-disc space-y-1.5 pl-5 pt-3 text-sm text-muted-foreground">
            {limits.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </details>
      </section>
    </div>
  )
}
