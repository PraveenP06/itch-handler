import { ArrowRight } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

const stages = [
  { name: "Framer", detail: "Splits the length-prefixed byte stream into messages.", metric: null, hot: false },
  { name: "Parser", detail: "Big-endian decode into a flat 48-byte event. No allocation.", metric: "221 M msg/s", hot: false },
  { name: "SPSC ring", detail: "Lock-free queue between a parser thread and a book thread.", metric: null, hot: false },
  { name: "Order book", detail: "Hash table of live orders and sorted price levels for every stock.", metric: "12 to 16 M msg/s", hot: true },
] as const

export function PipelineDiagram() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>How it is built</CardTitle>
        <CardDescription>Four stages. Parsing costs a few nanoseconds per message, so the book update is the bottleneck.</CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="grid items-stretch gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr]">
          {stages.flatMap((stage, i) => [
            <li key={stage.name} className={cn("rounded-lg border p-3", stage.hot ? "border-ask bg-ask-soft" : "bg-muted/40")}>
              <p className="font-heading font-semibold">{stage.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">{stage.detail}</p>
              {stage.metric ? <p className="num mt-2 text-sm font-medium">{stage.metric}</p> : null}
            </li>,
            i < stages.length - 1 ? (
              <li key={`arrow-${i}`} aria-hidden className="hidden items-center justify-center text-muted-foreground md:flex">
                <ArrowRight className="size-4" />
              </li>
            ) : null,
          ])}
        </ol>
      </CardContent>
    </Card>
  )
}
