"use client"

import { Pause, Play } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts"
import { LadderView } from "@/components/ladder-view"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Skeleton } from "@/components/ui/skeleton"
import { Slider } from "@/components/ui/slider"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { formatClock, formatInt } from "@/lib/format"
import { type ItchDay, messageMix, midPrice, parseItchDay, sessionOpenIndex } from "@/lib/itch"
import { buildLadder } from "@/lib/ladder"
import { firstQuotedIndex } from "@/lib/series"

const DEPTH = 10
const SPEEDS = ["1", "4", "12"] as const

const priceConfig = { mid: { label: "Mid price", color: "var(--chart-1)" } } satisfies ChartConfig
const activityConfig = { millions: { label: "Messages", color: "var(--chart-1)" } } satisfies ChartConfig

function useItchDay() {
  const [day, setDay] = useState<ItchDay | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    fetch("/data/itch-day.json", { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((raw) => setDay(parseItchDay(raw)))
      .catch((e: unknown) => {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "failed to load")
      })
    return () => controller.abort()
  }, [])
  return { day, error }
}

export function ReplayPanel() {
  const { day, error } = useItchDay()
  if (error) return <p className="text-sm text-destructive">Could not load the trading day: {error}</p>
  if (!day) return <ReplaySkeleton />
  return <Replay day={day} />
}

function ReplaySkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[26rem_minmax(0,1fr)]">
      <Skeleton className="h-[34rem]" />
      <Skeleton className="h-[34rem]" />
    </div>
  )
}

function Replay({ day }: { day: ItchDay }) {
  const names = Object.keys(day.symbols)
  const [symbol, setSymbol] = useState(names[0])
  const snapshots = day.symbols[symbol].snapshots
  const [index, setIndex] = useState(() => sessionOpenIndex(day.symbols[names[0]].snapshots))
  const [playing, setPlaying] = useState(() => !window.matchMedia("(prefers-reduced-motion: reduce)").matches)
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>("4")

  useEffect(() => {
    if (!playing) return
    const timer = setInterval(() => {
      setIndex((i) => {
        const next = i + Number(speed)
        if (next >= snapshots.length - 1) {
          setPlaying(false)
          return snapshots.length - 1
        }
        return next
      })
    }, 120)
    return () => clearInterval(timer)
  }, [playing, speed, snapshots.length])

  const snapshot = snapshots[Math.min(index, snapshots.length - 1)]
  const ladder = useMemo(() => buildLadder(snapshot.bids, snapshot.asks, DEPTH), [snapshot])
  const priceData = useMemo(() => snapshots.map((s, i) => ({ i, mid: midPrice(s) })), [snapshots])
  const firstQuote = useMemo(() => firstQuotedIndex(priceData.map((d) => d.mid)), [priceData])
  const quotedData = useMemo(() => priceData.slice(firstQuote), [priceData, firstQuote])
  const priceDomain = useMemo(() => {
    const mids = priceData.map((d) => d.mid).filter((m): m is number => m !== null)
    return [Math.floor(Math.min(...mids)), Math.ceil(Math.max(...mids))] as [number, number]
  }, [priceData])
  const firstMinute = day.perMinute.findIndex((n) => n > 0)
  const activityData = useMemo(
    () => day.perMinute.map((n, minute) => ({ minute, millions: n / 1e6 })).slice(Math.max(0, firstMinute)),
    [day.perMinute, firstMinute],
  )
  const mix = useMemo(() => messageMix(day), [day])

  function pick(name: string) {
    setSymbol(name)
    setIndex(sessionOpenIndex(day.symbols[name].snapshots))
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[26rem_minmax(0,1fr)]">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Order book</CardTitle>
            <CardDescription>
              Top {DEPTH} levels each side, rebuilt from individual orders. Snapshots every 30 seconds of exchange time.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ToggleGroup
              value={[symbol]}
              onValueChange={(v) => v[0] && pick(v[0])}
              variant="outline"
              size="sm"
              aria-label="Stock"
              className="flex-wrap"
            >
              {names.map((n) => (
                <ToggleGroupItem key={n} value={n}>
                  {n}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <div className="flex items-baseline justify-between">
              <span className="num text-3xl font-medium">{formatClock(snapshot.time)}</span>
              <span className="text-xs text-muted-foreground">exchange time, ET</span>
            </div>
            <LadderView ladder={ladder} depth={DEPTH} />
            <div className="flex items-center gap-3">
              <Button size="sm" variant="outline" onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Pause" : "Play"}>
                {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
                {playing ? "Pause" : "Play"}
              </Button>
              <Slider
                aria-label="Time of day"
                min={0}
                max={snapshots.length - 1}
                value={[index]}
                onValueChange={(v) => {
                  setPlaying(false)
                  setIndex(Array.isArray(v) ? v[0] : v)
                }}
              />
            </div>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">Speed</span>
              <ToggleGroup value={[speed]} onValueChange={(v) => v[0] && setSpeed(v[0] as (typeof SPEEDS)[number])} variant="outline" size="sm" aria-label="Playback speed">
                {SPEEDS.map((s) => (
                  <ToggleGroupItem key={s} value={s}>
                    {s}×
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          </CardContent>
        </Card>

        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{symbol} through the day</CardTitle>
              <CardDescription>Mid price from the rebuilt book. Click the chart to jump to a time.</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={priceConfig} className="h-64 w-full">
                <LineChart
                  data={quotedData}
                  margin={{ left: 4, right: 12, top: 8 }}
                  onClick={(state) => {
                    const i = Number(state?.activeTooltipIndex)
                    if (Number.isFinite(i)) {
                      setPlaying(false)
                      setIndex(firstQuote + i)
                    }
                  }}
                >
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="i" type="number" domain={[firstQuote, snapshots.length - 1]} allowDataOverflow tickFormatter={(i: number) => formatClock(snapshots[Math.min(i, snapshots.length - 1)].time).slice(0, 5)} tickCount={7} />
                  <YAxis domain={priceDomain} width={56} tickFormatter={(v: number) => v.toFixed(0)} />
                  <ChartTooltip content={<ChartTooltipContent labelFormatter={(_, p) => formatClock(snapshots[Number(p?.[0]?.payload?.i ?? 0)]?.time ?? 0)} />} />
                  <Line dataKey="mid" stroke="var(--color-mid)" strokeWidth={1.5} dot={false} connectNulls isAnimationActive={false} />
                  <ReferenceLine x={index} stroke="var(--foreground)" strokeWidth={1.5} />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>The whole market, per minute</CardTitle>
              <CardDescription>Messages across all {formatInt(day.byType.directory ?? 0)} listed stocks, not just the ones shown. The open and the close dwarf the rest of the day.</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={activityConfig} className="h-40 w-full">
                <BarChart data={activityData} margin={{ left: 4, right: 12 }} barCategoryGap={0}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="minute" tickFormatter={(m: number) => formatClock(m * 60).slice(0, 5)} tickCount={8} />
                  <YAxis width={36} tickFormatter={(v: number) => `${v}M`} />
                  <ChartTooltip content={<ChartTooltipContent formatter={(v) => `${Number(v).toFixed(2)} M messages`} labelFormatter={(_, p) => formatClock(Number(p?.[0]?.payload?.minute ?? 0) * 60)} />} />
                  <Bar dataKey="millions" fill="var(--color-millions)" isAnimationActive={false} />
                  <ReferenceLine x={Math.floor(snapshot.time / 60)} stroke="var(--foreground)" strokeWidth={1.5} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        <Card>
          <CardHeader>
            <CardTitle>What the {formatInt(day.messages)} messages are</CardTitle>
            <CardDescription>Most orders are added and then removed without ever trading.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {mix.map((m) => (
              <div key={m.label} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{m.label}</span>
                  <span className="num text-muted-foreground">{(m.share * 100).toFixed(1)}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-bid" style={{ width: `${Math.max(m.share * 100, 0.4)}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        </div>
      </div>

    </div>
  )
}
