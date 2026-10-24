import { cn } from "@/lib/utils"
import { formatUsd } from "@/lib/format"
import { type Trade, buyShare } from "@/lib/trades"

const SHOWN = 10
const clock = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })

export function TradeTape({ trades, connected }: { trades: Trade[]; connected: boolean }) {
  const share = buyShare(trades)
  if (trades.length === 0)
    return <p className="text-sm text-muted-foreground">{connected ? "Waiting for the next trade." : "Connecting to Coinbase's trade stream."}</p>
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Buyers {(share * 100).toFixed(0)}%</span>
          <span>Sellers {((1 - share) * 100).toFixed(0)}%</span>
        </div>
        <div className="flex h-2 overflow-hidden rounded-full bg-ask">
          <div className="h-full bg-bid transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${share * 100}%` }} />
        </div>
        <p className="text-xs text-muted-foreground">By size, over the last {trades.length} trades.</p>
      </div>
      <ul className="divide-y rounded-lg border bg-muted/40 font-mono text-[13px]">
        {trades.slice(0, SHOWN).map((t) => (
          <li key={t.id} className="grid grid-cols-[4.5rem_3.5rem_1fr_6.5rem] items-center px-3 py-1">
            <span className="num text-muted-foreground">{clock.format(t.at)}</span>
            <span className={cn("font-medium", t.side === "buy" ? "text-bid" : "text-ask")}>{t.side === "buy" ? "Buy" : "Sell"}</span>
            <span className="num">{t.size.toLocaleString("en-US", { minimumFractionDigits: 5, maximumFractionDigits: 8 })}</span>
            <span className="num text-right">{formatUsd(t.price)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
