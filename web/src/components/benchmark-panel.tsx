import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { benchmark, scaleBars } from "@/lib/benchmarks"
import { formatInt, formatNs } from "@/lib/format"
import { cn } from "@/lib/utils"

export function BenchmarkPanel() {
  const widths = scaleBars(benchmark.rows.map((r) => r.median))
  const latency = [
    ["p50", benchmark.latencyNs.p50],
    ["p90", benchmark.latencyNs.p90],
    ["p99", benchmark.latencyNs.p99],
    ["p99.9", benchmark.latencyNs.p999],
  ] as const
  return (
    <Card>
      <CardHeader>
        <CardTitle>Measured speed</CardTitle>
        <CardDescription>
          {benchmark.machine}, {benchmark.measuredOn}. Input: {benchmark.input}. Median of {benchmark.runs} runs, millions of messages per second.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <ul className="space-y-3">
          {benchmark.rows.map((row, i) => (
            <li key={row.label} className="grid grid-cols-[minmax(0,11rem)_1fr_7rem] items-center gap-3 text-sm max-sm:grid-cols-[1fr_6rem]">
              <span>{row.label}</span>
              <span className="h-3 overflow-hidden rounded-full bg-muted max-sm:order-3 max-sm:col-span-2">
                <span className={cn("block h-full rounded-full", row.tone === "bid" ? "bg-bid" : "bg-ask")} style={{ width: `${Math.max(widths[i] * 100, 1)}%` }} />
              </span>
              <span className="num text-right">
                {row.median} M/s
                <span className="block text-xs text-muted-foreground">
                  {row.low} to {row.high}
                </span>
              </span>
            </li>
          ))}
        </ul>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {latency.map(([label, ns]) => (
            <div key={label} className="rounded-lg border bg-muted/40 p-3">
              <dt className="text-xs text-muted-foreground">Latency {label}</dt>
              <dd className="num text-xl font-medium">{formatNs(ns)}</dd>
            </div>
          ))}
        </dl>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
          <li>Latency is the mean over 32-message batches, because one message is too fast to time reliably.</li>
          <li>Prefetching the order-table slot a few messages ahead gave about 30% more throughput. The two-thread pipeline did not beat one thread, because parsing is too cheap to be worth splitting off.</li>
          <li>
            Full day including decompression, one thread: {formatInt(benchmark.fullDay.messages)} messages in {benchmark.fullDay.seconds} seconds.
          </li>
        </ul>
      </CardContent>
    </Card>
  )
}
