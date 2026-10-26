"use client"

import { Activity, Pause, Play, ShieldCheck, TrendingDown, TrendingUp, Zap } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from "recharts"
import { CountUp } from "@/components/count-up"
import { InfoTip } from "@/components/info-tip"
import { LadderView } from "@/components/ladder-view"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Skeleton } from "@/components/ui/skeleton"
import { Slider } from "@/components/ui/slider"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { type DayEntry, dayLabel, parseDayIndex } from "@/lib/days"
import { formatClock, formatInt, formatUsd } from "@/lib/format"
import { type ItchDay, dayChange, messageMix, midPrice, parseItchDay, sessionOpenIndex } from "@/lib/itch"
import { buildLadder } from "@/lib/ladder"
import { firstQuotedIndex } from "@/lib/series"
import { cn } from "@/lib/utils"

const DEPTH = 10
const SPEEDS = ["1", "4", "12"] as const
const DEFAULT_SYMBOL = "AAPL"

const priceConfig = { mid: { label: "Mid price", color: "var(--chart-1)" } } satisfies ChartConfig
const activityConfig = { millions: { label: "Messages", color: "var(--chart-1)" } } satisfies ChartConfig

const mixTone: Record<string, string> = {
  "Add order": "bg-bid",
  "Delete order": "bg-ask",
  "Replace order": "bg-bid/55",
  "Executed (a trade)": "bg-ok",
  "Partial cancel": "bg-ask/55",
  Other: "bg-muted-foreground",
}

async function fetchJson(url: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json()
}

export function ReplayPanel() {
  const [days, setDays] = useState<DayEntry[] | null>(null)
  const [date, setDate] = useState<string | null>(null)
  const [symbol, setSymbol] = useState(DEFAULT_SYMBOL)
  const [loaded, setLoaded] = useState<{ date: string; day: ItchDay } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetchJson("/data/days/index.json", controller.signal)
      .then((raw) => {
        const parsed = parseDayIndex(raw)
        setDays(parsed)
        setDate(parsed.at(-1)?.date ?? null)
      })
      .catch((e: unknown) => {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "failed to load")
      })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!date) return
    const controller = new AbortController()
    fetchJson(`/data/days/${date}.json`, controller.signal)
      .then((raw) => setLoaded({ date, day: parseItchDay(raw) }))
      .catch((e: unknown) => {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "failed to load")
      })
    return () => controller.abort()
  }, [date])

  if (error) return <p className="text-sm text-destructive">Could not load the trading day: {error}</p>
  if (!days || !date) return <ReplaySkeleton />
  return (
    <div className="space-y-6">
      {days.length > 1 ? (
        <ToggleGroup value={[date]} onValueChange={(v) => v[0] && setDate(v[0])} variant="outline" aria-label="Trading day" className="flex-wrap">
          {days.map((d) => (
            <ToggleGroupItem key={d.date} value={d.date}>
              {dayLabel(d.date)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      ) : null}
      {loaded?.date === date ? <Replay key={date} date={date} day={loaded.day} symbol={symbol} onSymbol={setSymbol} /> : <ReplaySkeleton />}
    </div>
  )
}

function ReplaySkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[26rem_minmax(0,1fr)]">
        <Skeleton className="h-[34rem]" />
        <Skeleton className="h-[34rem]" />
      </div>
    </div>
  )
}

type TileProps = { icon: typeof Zap; tone: "bid" | "ok" | "ask"; label: string; children: React.ReactNode }

const toneClass = { bid: "bg-bid/15 text-bid", ok: "bg-ok/15 text-ok", ask: "bg-ask/15 text-ask" } as const

function Tile({ icon: Icon, tone, label, children }: TileProps) {
  return (
    <div className="space-y-2 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <span className={cn("inline-flex size-9 items-center justify-center rounded-lg", toneClass[tone])}>
        <Icon className="size-4.5" />
      </span>
      <p className="text-2xl font-medium sm:text-3xl">{children}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  )
}

type ReplayProps = { date: string; day: ItchDay; symbol: string; onSymbol: (symbol: string) => void }

function Replay({ date, day, symbol: requested, onSymbol }: ReplayProps) {
  const names = Object.keys(day.symbols)
  const symbol = names.includes(requested) ? requested : names[0]
  const snapshots = day.symbols[symbol].snapshots
  const [index, setIndex] = useState(() => sessionOpenIndex(snapshots))
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
  const change = useMemo(() => dayChange(snapshots), [snapshots])
  const up = change !== null && change.pct >= 0
  const Trend = up ? TrendingUp : TrendingDown

  function pick(name: string) {
    onSymbol(name)
    setIndex(sessionOpenIndex(day.symbols[name].snapshots))
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile icon={Zap} tone="bid" label={`messages on ${dayLabel(date)}`}>
          <CountUp value={day.messages} />
        </Tile>
        <Tile icon={ShieldCheck} tone="ok" label="book errors">
          <CountUp value={day.bookErrors} />
        </Tile>
        <Tile icon={Activity} tone="ask" label="orders left at the close">
          <CountUp value={day.liveOrdersEnd} />
        </Tile>
        <Tile icon={Trend} tone={up ? "ok" : "ask"} label={change ? `${symbol}, ${formatUsd(change.open)} to ${formatUsd(change.close)}` : symbol}>
          {change ? <span className="num">{`${up ? "+" : ""}${change.pct.toFixed(2)}%`}</span> : "n/a"}
        </Tile>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[26rem_minmax(0,1fr)]">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              Order book
              <InfoTip>Top 10 levels per side, rebuilt from individual orders. A snapshot every 30 seconds of exchange time.</InfoTip>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ToggleGroup value={[symbol]} onValueChange={(v) => v[0] && pick(v[0])} variant="outline" size="sm" aria-label="Stock" className="flex-wrap">
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
              <CardTitle className="flex items-center gap-1.5">
                {symbol} through the day
                <InfoTip>Mid price from the rebuilt book. Click the chart to jump to that time.</InfoTip>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={priceConfig} className="h-72 w-full">
                <AreaChart
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
                  <defs>
                    <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-mid)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--color-mid)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="i" type="number" domain={[firstQuote, snapshots.length - 1]} allowDataOverflow tickFormatter={(i: number) => formatClock(snapshots[Math.min(i, snapshots.length - 1)].time).slice(0, 5)} tickCount={7} />
                  <YAxis domain={priceDomain} width={56} tickFormatter={(v: number) => v.toFixed(0)} />
                  <ChartTooltip content={<ChartTooltipContent labelFormatter={(_, p) => formatClock(snapshots[Number(p?.[0]?.payload?.i ?? 0)]?.time ?? 0)} />} />
                  <Area dataKey="mid" type="monotone" stroke="var(--color-mid)" strokeWidth={2} fill="url(#priceFill)" dot={false} connectNulls isAnimationActive={false} />
                  <ReferenceLine x={index} stroke="var(--foreground)" strokeWidth={1.5} />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5">
                The whole market, per minute
                <InfoTip>{`Messages across all ${formatInt(day.byType.directory ?? 0)} listed stocks, not just the ones shown. The open and close dwarf the rest of the day.`}</InfoTip>
              </CardTitle>
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
              <CardTitle className="flex items-center gap-1.5">
                What the messages are
                <InfoTip>Most orders are added and then removed without ever trading.</InfoTip>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {mix.map((m) => (
                <div key={m.label} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>{m.label}</span>
                    <span className="num text-muted-foreground">{(m.share * 100).toFixed(1)}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className={cn("h-full rounded-full", mixTone[m.label] ?? "bg-bid")} style={{ width: `${Math.max(m.share * 100, 0.4)}%` }} />
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
