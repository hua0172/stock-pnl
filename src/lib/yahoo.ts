export interface YahooChartResult {
  meta: {
    regularMarketPrice: number;
  };
  timestamp: number[];
  indicators: {
    quote: Array<{ close: Array<number | null> }>;
  };
}

export async function fetchYahooChart(
  symbol: string,
  range: string,
): Promise<YahooChartResult> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=1d`;

  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });

  if (!res.ok) {
    throw new Error(
      `Yahoo Finance request failed for "${symbol}": ${res.status} ${res.statusText}`,
    );
  }

  const data = await res.json();
  const result = data?.chart?.result?.[0];

  if (!result) {
    throw new Error(`Yahoo Finance returned no data for "${symbol}"`);
  }

  return result;
}
