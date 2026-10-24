import { describe, expect, it } from "vitest"
import { buyShare, mergeTrades, parseTradeMessage } from "./trades"

const trade = (id: string, overrides: Record<string, string> = {}) => ({
  product_id: "BTC-USD",
  trade_id: id,
  price: "80259.95",
  size: "0.00038498",
  time: "2026-10-24T18:29:19.7362Z",
  side: "BUY",
  ...overrides,
})

const message = (type: string, trades: unknown[]) => ({
  channel: "market_trades",
  events: [{ type, trades }],
})

describe("parseTradeMessage", () => {
  it("reads price, size, side and time as numbers", () => {
    const [t] = parseTradeMessage(message("update", [trade("7")]))
    expect(t).toEqual({ id: "7", price: 80259.95, size: 0.00038498, side: "buy", at: Date.parse("2026-10-24T18:29:19.7362Z") })
  })

  it("maps SELL to sell", () => {
    expect(parseTradeMessage(message("update", [trade("8", { side: "SELL" })]))[0].side).toBe("sell")
  })

  it("ignores other channels such as subscription acknowledgements", () => {
    expect(parseTradeMessage({ channel: "subscriptions", events: [{ subscriptions: {} }] })).toEqual([])
  })

  it("ignores garbage rather than throwing", () => {
    expect(parseTradeMessage("nope")).toEqual([])
    expect(parseTradeMessage({ channel: "market_trades", events: [{ type: "update", trades: [{ price: "x" }] }] })).toEqual([])
  })
})

describe("mergeTrades", () => {
  const t = (id: string, at: number) => ({ id, price: 1, size: 1, side: "buy" as const, at })

  it("puts the newest trade first", () => {
    expect(mergeTrades([t("1", 1)], [t("2", 2)], 10).map((x) => x.id)).toEqual(["2", "1"])
  })

  it("drops a trade it has already seen", () => {
    expect(mergeTrades([t("1", 1)], [t("1", 1), t("2", 2)], 10).map((x) => x.id)).toEqual(["2", "1"])
  })

  it("keeps only the most recent trades up to the limit", () => {
    expect(mergeTrades([t("2", 2), t("1", 1)], [t("3", 3)], 2).map((x) => x.id)).toEqual(["3", "2"])
  })
})

describe("buyShare", () => {
  const at = (side: "buy" | "sell", size: number) => ({ id: String(Math.random()), price: 1, size, side, at: 1 })

  it("is the share of traded size where the buyer was the aggressor", () => {
    expect(buyShare([at("buy", 3), at("sell", 1)])).toBe(0.75)
  })

  it("is half when nothing has traded yet", () => {
    expect(buyShare([])).toBe(0.5)
  })
})
