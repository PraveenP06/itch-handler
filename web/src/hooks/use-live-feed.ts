"use client"

import { useEffect, useRef, useState } from "react"
import { type LiveBook, type LiveSample, parseLiveBook, parseLiveSample } from "@/lib/live"

export type FeedMode = "connecting" | "live" | "recorded"

const POLL_MS = 250
const FAILURES_BEFORE_FALLBACK = 3
const HISTORY = 240

export type LiveFeed = {
  mode: FeedMode
  book: LiveBook | null
  history: number[]
  capturedAt: string | null
  error: string | null
}

function midOf(book: LiveBook): number | null {
  const bid = book.bids[0]
  const ask = book.asks[0]
  return bid && ask ? (bid.price + ask.price) / 2 : null
}

export function useLiveFeed(liveUrl: string | undefined): LiveFeed {
  const [mode, setMode] = useState<FeedMode>(liveUrl ? "connecting" : "recorded")
  const [book, setBook] = useState<LiveBook | null>(null)
  const [history, setHistory] = useState<number[]>([])
  const [sample, setSample] = useState<LiveSample | null>(null)
  const [error, setError] = useState<string | null>(null)
  const failures = useRef(0)
  const frame = useRef(0)

  function remember(next: LiveBook) {
    setBook(next)
    const mid = midOf(next)
    if (mid !== null) setHistory((h) => [...h.slice(-(HISTORY - 1)), mid])
  }

  useEffect(() => {
    const controller = new AbortController()
    fetch("/data/live-sample.json", { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((raw) => setSample(parseLiveSample(raw)))
      .catch((e: unknown) => {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "could not load the recorded session")
      })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!liveUrl) return
    const controller = new AbortController()
    let stopped = false
    async function poll() {
      try {
        const response = await fetch(`${liveUrl}/book`, { signal: controller.signal, cache: "no-store" })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const parsed = parseLiveBook(await response.json())
        failures.current = 0
        setMode("live")
        setError(null)
        remember(parsed)
      } catch (e) {
        if (controller.signal.aborted) return
        failures.current += 1
        if (failures.current >= FAILURES_BEFORE_FALLBACK) setMode("recorded")
        setError(e instanceof Error ? e.message : "live engine unreachable")
      }
    }
    const timer = setInterval(() => {
      if (!stopped) void poll()
    }, POLL_MS)
    void poll()
    return () => {
      stopped = true
      controller.abort()
      clearInterval(timer)
    }
  }, [liveUrl])

  useEffect(() => {
    if (mode !== "recorded" || !sample || sample.frames.length === 0) return
    const timer = setInterval(() => {
      frame.current = (frame.current + 1) % sample.frames.length
      if (frame.current === 0) setHistory([])
      remember(sample.frames[frame.current])
    }, sample.intervalS * 1000)
    remember(sample.frames[frame.current])
    return () => clearInterval(timer)
  }, [mode, sample])

  return { mode, book, history, capturedAt: sample?.capturedAt ?? null, error }
}
