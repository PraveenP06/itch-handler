"use client"

import { useMemo } from "react"
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import type { LatencyPoint } from "@/hooks/use-live-feed"

const config = {
  p50: { label: "Typical (p50)", color: "var(--chart-1)" },
  p99: { label: "Slow end (p99)", color: "var(--chart-2)" },
} satisfies ChartConfig

export function LatencyChart({ points }: { points: LatencyPoint[] }) {
  const data = useMemo(() => points.map((p, i) => ({ i, p50: p.p50Ns / 1000, p99: p.p99Ns / 1000 })), [points])
  return (
    <ChartContainer config={config} className="h-48 w-full">
      <LineChart data={data} margin={{ left: 4, right: 12, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="i" hide />
        <YAxis width={52} tickFormatter={(v: number) => `${v.toFixed(0)} µs`} />
        <ChartTooltip content={<ChartTooltipContent labelFormatter={() => "Engine time per message"} formatter={(v) => `${Number(v).toFixed(1)} µs`} />} />
        <Line dataKey="p50" stroke="var(--color-p50)" strokeWidth={1.75} dot={false} isAnimationActive={false} />
        <Line dataKey="p99" stroke="var(--color-p99)" strokeWidth={1.75} dot={false} isAnimationActive={false} />
      </LineChart>
    </ChartContainer>
  )
}
