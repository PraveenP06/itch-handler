"use client"

import { useEffect, useState } from "react"
import { type Trade, mergeTrades, parseTradeMessage } from "@/lib/trades"

const URL = "wss://advanced-trade-ws.coinbase.com"
const KEPT = 40
const MAX_RETRY_MS = 15_000

export function useTrades(enabled: boolean): { trades: Trade[]; connected: boolean } {
  const [trades, setTrades] = useState<Trade[]>([])
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!enabled) return
    let socket: WebSocket | null = null
    let timer: ReturnType<typeof setTimeout> | undefined
    let closed = false
    let attempt = 0

    function open() {
      const ws = new WebSocket(URL)
      socket = ws
      ws.onopen = () => {
        attempt = 0
        setConnected(true)
        ws.send(JSON.stringify({ type: "subscribe", product_ids: ["BTC-USD"], channel: "market_trades" }))
      }
      ws.onmessage = (event) => {
        try {
          const fresh = parseTradeMessage(JSON.parse(String(event.data)))
          if (fresh.length > 0) setTrades((current) => mergeTrades(current, fresh, KEPT))
        } catch {
          return
        }
      }
      ws.onclose = () => {
        setConnected(false)
        if (closed) return
        timer = setTimeout(open, Math.min(1000 * 2 ** attempt++, MAX_RETRY_MS))
      }
    }

    open()
    return () => {
      closed = true
      clearTimeout(timer)
      socket?.close()
    }
  }, [enabled])

  return { trades, connected }
}
