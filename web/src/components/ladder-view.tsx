"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { type Flash, type Ladder, type LadderRow, diffLevels } from "@/lib/ladder"
import { formatBps, formatUsd } from "@/lib/format"

type Props = {
  ladder: Ladder
  depth: number
  sizeDigits?: number
  flash?: boolean
}

type Flashes = { changed: Map<number, Flash>; round: number }

const rowsOf = (ladder: Ladder) => [...ladder.asks, ...ladder.bids]

function flashColour(side: "ask" | "bid", kind: Flash): string {
  if (kind === "shrank") return "bg-muted-foreground"
  return side === "ask" ? "bg-ask" : "bg-bid"
}

function Row({ row, side, sizeDigits, flash, round }: { row: LadderRow | undefined; side: "ask" | "bid"; sizeDigits: number; flash?: Flash; round: number }) {
  return (
    <div className="relative grid h-7 grid-cols-[1fr_6.5rem] items-center font-mono text-[13px]">
      {row ? (
        <span
          aria-hidden
          className={cn(
            "absolute inset-y-0.5 left-0 rounded-sm transition-[width] duration-150 ease-linear motion-reduce:transition-none",
            side === "ask" ? "bg-ask-soft" : "bg-bid-soft",
          )}
          style={{ width: `${(row.share * 100).toFixed(1)}%` }}
        />
      ) : null}
      {row && flash ? <span key={`${row.price}-${round}`} aria-hidden className={cn("level-flash absolute inset-y-0.5 inset-x-0 rounded-sm", flashColour(side, flash))} /> : null}
      <span className="num relative pl-3">{row ? row.size.toLocaleString("en-US", { maximumFractionDigits: sizeDigits, minimumFractionDigits: sizeDigits }) : ""}</span>
      <span className={cn("num relative pr-3 text-right font-medium", side === "ask" ? "text-ask" : "text-bid")}>
        {row ? formatUsd(row.price) : ""}
      </span>
    </div>
  )
}

const stateLabel: Record<Ladder["state"], string> = {
  ok: "",
  locked: "locked",
  crossed: "crossed",
  "one-sided": "one-sided book",
  empty: "empty book",
}

export function LadderView({ ladder, depth, sizeDigits = 0, flash = false }: Props) {
  const [seen, setSeen] = useState(ladder)
  const [flashes, setFlashes] = useState<Flashes>({ changed: new Map(), round: 0 })
  if (ladder !== seen) {
    setSeen(ladder)
    if (flash) setFlashes((f) => ({ changed: diffLevels(rowsOf(seen), rowsOf(ladder)), round: f.round + 1 }))
  }
  const asks = Array.from({ length: depth }, (_, i) => ladder.asks[i])
  const bids = Array.from({ length: depth }, (_, i) => ladder.bids[i])
  const kind = (row: LadderRow | undefined) => (row ? flashes.changed.get(row.price) : undefined)
  return (
    <div role="table" aria-label="Order book" className="overflow-hidden rounded-lg border bg-muted/40">
      <div role="rowgroup">
        {[...asks].reverse().map((row, i) => (
          <Row key={`a${i}`} row={row} side="ask" sizeDigits={sizeDigits} flash={kind(row)} round={flashes.round} />
        ))}
      </div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 border-y bg-card px-3 py-2 font-mono text-[13px]">
        <span className="num font-medium">{ladder.mid !== null ? `mid ${formatUsd(ladder.mid)}` : stateLabel[ladder.state]}</span>
        <span className="num text-muted-foreground">
          {ladder.spread !== null && ladder.spreadBps !== null
            ? ladder.state === "ok"
              ? `spread ${formatUsd(ladder.spread)} · ${formatBps(ladder.spreadBps)}`
              : stateLabel[ladder.state]
            : ""}
        </span>
      </div>
      <div role="rowgroup">
        {bids.map((row, i) => (
          <Row key={`b${i}`} row={row} side="bid" sizeDigits={sizeDigits} flash={kind(row)} round={flashes.round} />
        ))}
      </div>
    </div>
  )
}
