"use client"

import { useMemo } from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { type Level, cumulativeDepth } from "@/lib/ladder"

const config = {
  bid: { label: "Buyers", color: "var(--bid)" },
  ask: { label: "Sellers", color: "var(--ask)" },
} satisfies ChartConfig

type Props = { bids: Level[]; asks: Level[] }

export function DepthChart({ bids, asks }: Props) {
  const { data, domain } = useMemo(() => {
    const depth = cumulativeDepth(bids, asks)
    const rows = [
      ...depth.bids.map((p) => ({ price: p.price, bid: p.total })),
      ...depth.asks.map((p) => ({ price: p.price, ask: p.total })),
    ]
    const prices = rows.map((r) => r.price)
    return { data: rows, domain: [Math.min(...prices), Math.max(...prices)] as [number, number] }
  }, [bids, asks])

  if (data.length === 0) return null
  return (
    <ChartContainer config={config} className="h-48 w-full">
      <AreaChart data={data} margin={{ left: 4, right: 12, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="price" type="number" domain={domain} tickCount={5} tickFormatter={(v: number) => v.toFixed(0)} />
        <YAxis width={44} tickFormatter={(v: number) => v.toFixed(1)} />
        <ChartTooltip content={<ChartTooltipContent labelFormatter={(_, p) => `$${Number(p?.[0]?.payload?.price ?? 0).toFixed(2)}`} formatter={(v) => `${Number(v).toFixed(3)} BTC`} />} />
        <Area dataKey="bid" type="stepBefore" stroke="var(--color-bid)" fill="var(--color-bid)" fillOpacity={0.25} strokeWidth={1.5} isAnimationActive={false} />
        <Area dataKey="ask" type="stepAfter" stroke="var(--color-ask)" fill="var(--color-ask)" fillOpacity={0.25} strokeWidth={1.5} isAnimationActive={false} />
      </AreaChart>
    </ChartContainer>
  )
}
