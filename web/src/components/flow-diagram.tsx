import { ArrowRight, Binary, BookOpen, Globe, Layers, Plug, Radio, Scissors, ScanText, Terminal } from "lucide-react"
import { InfoTip } from "@/components/info-tip"
import { cn } from "@/lib/utils"

type Node = { icon: typeof Radio; title: string; line: string; metric?: string; tip?: string }
type Lane = { name: string; tone: "bid" | "ask"; nodes: Node[] }

const lanes: Lane[] = [
  {
    name: "NASDAQ replay, every order",
    tone: "bid",
    nodes: [
      { icon: BookOpen, title: "ITCH file", line: "Raw bytes, one message per order event", tip: "ITCH is NASDAQ's raw data feed. Every order placed, changed, cancelled or filled is one tiny message." },
      { icon: Scissors, title: "Framer", line: "Cuts the stream into messages" },
      { icon: Binary, title: "Parser", line: "Decodes bytes into readable events", metric: "221 M/s, parser only" },
      { icon: Layers, title: "Order book", line: "Tracks every open order", metric: "12 to 16 M/s, whole job" },
    ],
  },
  {
    name: "Live Bitcoin, totals per price",
    tone: "ask",
    nodes: [
      { icon: Radio, title: "Coinbase feed", line: "Text messages over a websocket" },
      { icon: Plug, title: "Python", line: "Holds the connection, passes lines on" },
      { icon: ScanText, title: "C++ parser", line: "Reads each text message" },
      { icon: Layers, title: "Order book", line: "Total size at each price", metric: "about 25 µs per message" },
    ],
  },
]

const toneClasses = {
  bid: { chip: "bg-bid/15 text-bid", line: "text-bid", ring: "ring-bid/30" },
  ask: { chip: "bg-ask/15 text-ask", line: "text-ask", ring: "ring-ask/30" },
} as const

function Connector({ tone }: { tone: "bid" | "ask" }) {
  return (
    <div aria-hidden className={cn("flex items-center justify-center max-md:h-6 md:w-8", toneClasses[tone].line)}>
      <span className="flow-line h-0.5 w-5 max-md:hidden" />
      <ArrowRight className="size-4 shrink-0 max-md:rotate-90" />
    </div>
  )
}

function NodeCard({ node, tone }: { node: Node; tone: "bid" | "ask" }) {
  return (
    <li className={cn("min-w-0 flex-1 space-y-1.5 rounded-xl bg-card p-3 ring-1", toneClasses[tone].ring)}>
      <div className="flex items-center gap-2">
        <span className={cn("inline-flex size-8 shrink-0 items-center justify-center rounded-lg", toneClasses[tone].chip)}>
          <node.icon className="size-4" />
        </span>
        <span className="flex items-center gap-1 font-semibold">
          {node.title}
          {node.tip ? <InfoTip>{node.tip}</InfoTip> : null}
        </span>
      </div>
      <p className="text-sm text-muted-foreground">{node.line}</p>
      {node.metric ? <p className={cn("num inline-block rounded-md px-2 py-0.5 text-xs", toneClasses[tone].chip)}>{node.metric}</p> : null}
    </li>
  )
}

export function FlowDiagram() {
  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto_11rem] md:items-stretch">
      <div className="space-y-6">
        {lanes.map((lane) => (
          <div key={lane.name} className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{lane.name}</p>
            <ol className="flex flex-col md:flex-row md:items-stretch">
              {lane.nodes.flatMap((node, i) => [
                <NodeCard key={node.title + lane.name} node={node} tone={lane.tone} />,
                i < lane.nodes.length - 1 ? <Connector key={`c${i}${lane.name}`} tone={lane.tone} /> : null,
              ])}
            </ol>
          </div>
        ))}
      </div>
      <div aria-hidden className="flex items-center justify-center text-muted-foreground max-md:h-6 md:w-8">
        <ArrowRight className="size-5 max-md:rotate-90" />
      </div>
      <div className="flex flex-col justify-center gap-2 rounded-xl bg-card p-4 ring-1 ring-foreground/20">
        <span className="inline-flex size-9 items-center justify-center rounded-lg bg-ok/15 text-ok">
          <Globe className="size-5" />
        </span>
        <p className="font-semibold">This website</p>
        <p className="text-sm text-muted-foreground">Replay reads saved results. Live asks the server several times a second.</p>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Terminal className="size-3.5" /> Next.js on Vercel
        </p>
      </div>
    </div>
  )
}
