"use client"

import { useEffect, useState } from "react"
import { countAt } from "@/lib/count"

type Props = { value: number; decimals?: number; durationMs?: number; suffix?: string }

export function CountUp({ value, decimals = 0, durationMs = 1400, suffix = "" }: Props) {
  const [shown, setShown] = useState(value)

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    let frame = 0
    const start = performance.now()
    const tick = (now: number) => {
      const progress = (now - start) / durationMs
      setShown(countAt({ target: value, progress }))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value, durationMs])

  const text = shown.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  return (
    <span className="num">
      {text}
      {suffix}
    </span>
  )
}
