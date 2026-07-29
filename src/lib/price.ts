import { toYahooSymbolCandidates } from "./market";
import type { Market } from "./pnl";
import { fetchYahooChart } from "./yahoo";

export async function fetchCurrentPrice(
  market: Market,
  symbol: string,
): Promise<number> {
  const candidates = toYahooSymbolCandidates(market, symbol);

  let lastError: unknown;
  for (const yahooSymbol of candidates) {
    try {
      const result = await fetchYahooChart(yahooSymbol, "1d");
      const price = result.meta.regularMarketPrice;

      if (typeof price === "number") {
        return price;
      }
      lastError = new Error(`目前無法取得「${symbol}」的股價`);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError;
}
