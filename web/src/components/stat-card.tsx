import { Card, CardContent } from "@/components/ui/card"

type Props = { label: string; value: string; hint?: string }

export function StatCard({ label, value, hint }: Props) {
  return (
    <Card size="sm">
      <CardContent className="space-y-0.5">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="num text-xl font-medium">{value}</p>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  )
}
