import type { Market } from "./pnl";
import { fetchYahooChart } from "./yahoo";

function toYahooSymbol(market: Market, symbol: string): string {
  return market === "TW" ? `${symbol}.TW` : symbol;
}

export async function fetchCurrentPrice(
  market: Market,
  symbol: string,
): Promise<number> {
  const result = await fetchYahooChart(toYahooSymbol(market, symbol), "1d");
  const price = result.meta.regularMarketPrice;

  if (typeof price !== "number") {
    throw new Error(`No current price available for "${symbol}"`);
  }

  return price;
}
