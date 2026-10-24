import { Info } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

export function InfoTip({ children }: { children: string }) {
  return (
    <Tooltip>
      <TooltipTrigger aria-label="More info" className="inline-flex size-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground">
        <Info className="size-3.5" />
      </TooltipTrigger>
      <TooltipContent className="max-w-64">{children}</TooltipContent>
    </Tooltip>
  )
}
