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

export function toYahooSymbol(market: Market, symbol: string): string {
  return market === "TW" ? `${symbol}.TW` : symbol;
}
