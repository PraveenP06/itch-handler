"use client"

import { Activity, Gauge, Layers, ShieldCheck, TrendingDown, TrendingUp } from "lucide-react"
import { useMemo } from "react"
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import { DepthChart } from "@/components/depth-chart"
import { InfoTip } from "@/components/info-tip"
import { LadderView } from "@/components/ladder-view"
import { LatencyChart } from "@/components/latency-chart"
import { TradeTape } from "@/components/trade-tape"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { type ChartConfig, ChartContainer } from "@/components/ui/chart"
import { Skeleton } from "@/components/ui/skeleton"
import { useLiveFeed } from "@/hooks/use-live-feed"
import { useTrades } from "@/hooks/use-trades"
import { formatBps, formatInt, formatNs, formatUsd } from "@/lib/format"
import { buildLadder } from "@/lib/ladder"
import { isStale } from "@/lib/live"
import { tightDomain } from "@/lib/series"
import { cn } from "@/lib/utils"

const DEPTH = 12
const config = { mid: { label: "Mid price", color: "var(--chart-1)" } } satisfies ChartConfig

function StatusBadge({ mode, stale, ageMs }: { mode: "connecting" | "live" | "recorded"; stale: boolean; ageMs: number }) {
  if (mode === "live")
    return (
      <Badge variant="outline" className="gap-2">
        <span className={`size-2 rounded-full ${stale ? "bg-destructive" : "bg-ok animate-pulse motion-reduce:animate-none"}`} />
        {stale ? `Stale, ${(ageMs / 1000).toFixed(0)} s ago` : `Live, ${ageMs} ms ago`}
      </Badge>
    )
  if (mode === "recorded")
    return (
      <Badge variant="secondary" className="gap-2">
        <span className="size-2 rounded-full bg-muted-foreground" />
        Recording
      </Badge>
    )
  return <Badge variant="outline">Connecting</Badge>
}

function Pill({ icon: Icon, label, value, tip }: { icon: typeof Activity; label: string; value: string; tip?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10">
      <span className="inline-flex size-9 items-center justify-center rounded-lg bg-bid/15 text-bid">
        <Icon className="size-4.5" />
      </span>
      <div className="min-w-0">
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          {label}
          {tip ? <InfoTip>{tip}</InfoTip> : null}
        </p>
        <p className="num truncate text-lg font-medium">{value}</p>
      </div>
    </div>
  )
}

function CardTitleRow({ title, tip }: { title: string; tip?: string }) {
  return (
    <CardTitle className="flex items-center gap-1.5">
      {title}
      {tip ? <InfoTip>{tip}</InfoTip> : null}
    </CardTitle>
  )
}

export function LivePanel() {
  const liveUrl = process.env.NEXT_PUBLIC_LIVE_URL || undefined
  const { mode, book, history, latency, error } = useLiveFeed(liveUrl)
  const { trades, connected } = useTrades(mode === "live")
  const ladder = useMemo(() => (book ? buildLadder(book.bids, book.asks, DEPTH) : null), [book])
  const chartData = useMemo(() => history.map((mid, i) => ({ i, mid })), [history])
  const range = useMemo(() => tightDomain(history, { minSpan: 2 }), [history])

  if (!book || !ladder) {
    if (error && !liveUrl) return <p className="text-sm text-destructive">Could not load the recorded session: {error}</p>
    return <Skeleton className="h-[36rem] w-full" />
  }

  const previous = history.at(-2)
  const mid = ladder.mid
  const rising = mid !== null && previous !== undefined && mid >= previous
  const Trend = rising ? TrendingUp : TrendingDown

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge mode={mode} stale={isStale(book)} ageMs={book.stats.ageMs} />
        {mode === "recorded" ? <p className="text-sm text-muted-foreground">The live engine is offline, so this is a recording.</p> : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="flex items-center justify-between gap-3 rounded-xl bg-card px-4 py-3 shadow-[0_0_60px_-28px_var(--bid)] ring-1 ring-foreground/10 sm:col-span-2">
          <div>
            <p className="text-xs text-muted-foreground">BTC-USD</p>
            <p className="num text-3xl font-medium">{mid !== null ? formatUsd(mid) : "…"}</p>
          </div>
          <div className={cn("flex flex-col items-end text-sm", rising ? "text-ok" : "text-destructive")}>
            <Trend className="size-5" />
            <span className="num text-muted-foreground">{ladder.spreadBps !== null ? `spread ${formatBps(ladder.spreadBps)}` : ""}</span>
          </div>
        </div>
        <Pill icon={Activity} label="Messages per second" value={book.stats.msgsPerSec.toFixed(1)} />
        <Pill icon={Gauge} label="Typical time" value={formatNs(book.stats.p50Ns)} tip="How long the engine spends on one message. Not network delay." />
        <Pill icon={ShieldCheck} label="Gaps in the feed" value={formatInt(book.stats.gaps)} tip="Missing messages. Zero means the book is complete." />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[26rem_minmax(0,1fr)]">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitleRow title="Order book" tip="Total size at each price, rebuilt by the C++ engine from Coinbase's raw feed. Cells flash when a size changes." />
          </CardHeader>
          <CardContent>
            <LadderView ladder={ladder} depth={DEPTH} sizeDigits={4} flash />
          </CardContent>
        </Card>

        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader>
              <CardTitleRow title="Price, last minute" />
            </CardHeader>
            <CardContent>
              <ChartContainer config={config} className="h-56 w-full">
                <LineChart data={chartData} margin={{ left: 4, right: 12, top: 8 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="i" hide />
                  <YAxis domain={range} width={76} tickFormatter={(v: number) => v.toFixed(2)} />
                  <Line dataKey="mid" stroke="var(--color-mid)" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitleRow title="Depth" tip="How much Bitcoin waits at each price. Buyers left, sellers right. Steep walls are big orders." />
            </CardHeader>
            <CardContent>
              <DepthChart bids={book.bids} asks={book.asks} />
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitleRow title="Recent trades" tip="Live trades from Coinbase. The C++ engine rebuilds the book." />
          </CardHeader>
          <CardContent>{mode === "live" ? <TradeTape trades={trades} connected={connected} /> : <p className="text-sm text-muted-foreground">Trades show when the engine is live.</p>}</CardContent>
        </Card>
        <Card className="min-w-0">
          <CardHeader>
            <CardTitleRow title="Engine time per message" tip="Measured by the C++ engine while you watch. Typical is the median; slow end is the 99th percentile." />
          </CardHeader>
          <CardContent>
            <LatencyChart points={latency} />
          </CardContent>
        </Card>
      </div>

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Layers className="size-3.5" /> {formatInt(book.stats.messages)} messages processed, {formatInt(book.stats.levels)} price levels tracked.
      </p>
    </div>
  )
}
