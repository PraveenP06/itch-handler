"use client"

import { useMemo } from "react"
import { LadderView } from "@/components/ladder-view"
import { Skeleton } from "@/components/ui/skeleton"
import { useLiveFeed } from "@/hooks/use-live-feed"
import { formatNs, formatUsd } from "@/lib/format"
import { buildLadder } from "@/lib/ladder"
import { cn } from "@/lib/utils"

const DEPTH = 6

export function HeroBook() {
  const { mode, book } = useLiveFeed(process.env.NEXT_PUBLIC_LIVE_URL || undefined)
  const ladder = useMemo(() => (book ? buildLadder(book.bids, book.asks, DEPTH) : null), [book])
  const live = mode === "live"
  return (
    <div className="rounded-2xl bg-card/80 p-4 shadow-[0_0_80px_-24px_var(--bid)] ring-1 ring-foreground/10 backdrop-blur">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">BTC-USD</p>
          <p className="num text-3xl font-medium">{ladder?.mid != null ? formatUsd(ladder.mid) : "…"}</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium">
          <span className={cn("size-2 rounded-full", live ? "animate-pulse bg-ok motion-reduce:animate-none" : "bg-muted-foreground")} />
          {live ? "Live" : mode === "connecting" ? "Connecting" : "Recorded"}
        </span>
      </div>
      {ladder ? <LadderView ladder={ladder} depth={DEPTH} sizeDigits={4} flash /> : <Skeleton className="h-[21rem] w-full" />}
      <div className="mt-3 flex justify-between text-xs text-muted-foreground">
        <span>{book ? `${book.stats.msgsPerSec.toFixed(0)} messages/s` : ""}</span>
        <span>{book ? `${formatNs(book.stats.p50Ns)} per message` : ""}</span>
      </div>
    </div>
  )
}
