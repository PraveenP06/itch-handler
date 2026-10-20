"use client"

import { useMemo } from "react"
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import { LadderView } from "@/components/ladder-view"
import { StatCard } from "@/components/stat-card"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { type ChartConfig, ChartContainer } from "@/components/ui/chart"
import { Skeleton } from "@/components/ui/skeleton"
import { useLiveFeed } from "@/hooks/use-live-feed"
import { formatInt, formatNs } from "@/lib/format"
import { buildLadder } from "@/lib/ladder"
import { isStale } from "@/lib/live"

const DEPTH = 12
const config = { mid: { label: "Mid price", color: "var(--chart-1)" } } satisfies ChartConfig

function StatusBadge({ mode, stale, ageMs }: { mode: "connecting" | "live" | "recorded"; stale: boolean; ageMs: number }) {
  if (mode === "live")
    return (
      <Badge variant="outline" className="gap-2">
        <span className={`size-2 rounded-full ${stale ? "bg-destructive" : "bg-ok animate-pulse motion-reduce:animate-none"}`} />
        {stale ? `Stale, last message ${(ageMs / 1000).toFixed(0)} s ago` : `Live, last message ${ageMs} ms ago`}
      </Badge>
    )
  if (mode === "recorded")
    return (
      <Badge variant="secondary" className="gap-2">
        <span className="size-2 rounded-full bg-muted-foreground" />
        Recorded session
      </Badge>
    )
  return <Badge variant="outline">Connecting</Badge>
}

export function LivePanel() {
  const liveUrl = process.env.NEXT_PUBLIC_LIVE_URL || undefined
  const { mode, book, history, capturedAt, error } = useLiveFeed(liveUrl)
  const ladder = useMemo(() => (book ? buildLadder(book.bids, book.asks, DEPTH) : null), [book])
  const chartData = useMemo(() => history.map((mid, i) => ({ i, mid })), [history])
  const range = useMemo(() => {
    if (history.length === 0) return [0, 1] as [number, number]
    const lo = Math.min(...history)
    const hi = Math.max(...history)
    const pad = Math.max((hi - lo) * 0.2, 1)
    return [lo - pad, hi + pad] as [number, number]
  }, [history])

  if (!book || !ladder) {
    if (error && !liveUrl) return <p className="text-sm text-destructive">Could not load the recorded session: {error}</p>
    return <Skeleton className="h-[36rem] w-full" />
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge mode={mode} stale={isStale(book)} ageMs={book.stats.ageMs} />
        {mode === "recorded" ? (
          <p className="text-sm text-muted-foreground">
            The live engine runs on a private server. This replays {capturedAt ? `a five-minute recording of its real output from ${new Date(capturedAt).toUTCString()}` : "a recording of its real output"}.
            {error && liveUrl ? ` Live connection failed: ${error}.` : ""}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[26rem_minmax(0,1fr)]">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>BTC-USD on Coinbase</CardTitle>
            <CardDescription>Level 2: total size at each price, rebuilt by the C++ engine from the raw feed.</CardDescription>
          </CardHeader>
          <CardContent>
            <LadderView ladder={ladder} depth={DEPTH} sizeDigits={4} />
          </CardContent>
        </Card>

        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Mid price, last minute</CardTitle>
              <CardDescription>Newest on the right.</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={config} className="h-40 w-full">
                <LineChart data={chartData} margin={{ left: 4, right: 12, top: 8 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="i" hide />
                  <YAxis domain={range} width={64} tickFormatter={(v: number) => v.toFixed(0)} />
                  <Line dataKey="mid" stroke="var(--color-mid)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard label="Messages per second" value={book.stats.msgsPerSec.toFixed(1)} />
            <StatCard label="Messages processed" value={formatInt(book.stats.messages)} />
            <StatCard label="Levels tracked" value={formatInt(book.stats.levels)} />
            <StatCard label="Process time, p50" value={formatNs(book.stats.p50Ns)} hint="per message" />
            <StatCard label="Process time, p99" value={formatNs(book.stats.p99Ns)} hint="per message" />
            <StatCard label="Sequence gaps" value={formatInt(book.stats.gaps)} hint={`${formatInt(book.stats.crossedEvents)} crossed-book events`} />
          </div>
        </div>
      </div>

      <p className="max-w-3xl text-sm text-muted-foreground">
        Process time is how long the engine spends parsing and applying one message, not network latency. This is Level 2 crypto data, not NASDAQ order-by-order data.
      </p>
    </div>
  )
}
