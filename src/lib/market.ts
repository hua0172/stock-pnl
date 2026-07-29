import type { Currency } from "./fx";
import type { Market } from "./pnl";

export const MARKET_CURRENCY: Record<Market, Currency> = {
  TW: "TWD",
  US: "USD",
};

export const MARKET_PRICE_PREFIX: Record<Market, string> = {
  TW: "NT$",
  US: "$",
};

export const MARKET_LABEL: Record<Market, string> = {
  TW: "台股",
  US: "美股",
};

// TW-listed securities trade on either the Taiwan Stock Exchange (Yahoo
// suffix .TW) or the Taipei Exchange / TPEx (.TWO, e.g. many bond ETFs) —
// there's no way to tell which from the symbol alone, so callers try both.
export function toYahooSymbolCandidates(market: Market, symbol: string): string[] {
  return market === "TW" ? [`${symbol}.TW`, `${symbol}.TWO`] : [symbol];
}
