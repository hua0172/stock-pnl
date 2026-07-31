export interface YahooChartResult {
  meta: {
    regularMarketPrice: number;
    shortName?: string;
  };
  timestamp: number[];
  indicators: {
    quote: Array<{ close: Array<number | null> }>;
  };
}

// Shared with symbol-existence.ts, which needs its own low-level fetch of
// this same endpoint (to distinguish a definitive 404 from an ambiguous
// failure — something fetchYahooChart's single thrown Error type can't do).
export const YAHOO_USER_AGENT = "Mozilla/5.0";

// `events` is passed through as-is (e.g. "div" for dividend events) — used
// by dividend-detection.ts's US dividend-event fetch; existing callers that
// omit it see no change in the URL they build.
export function buildYahooChartUrl(
  symbol: string,
  range: string,
  options?: { events?: string },
): string {
  const base = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=1d`;
  return options?.events ? `${base}&events=${options.events}` : base;
}

export async function fetchYahooChart(
  symbol: string,
  range: string,
): Promise<YahooChartResult> {
  const url = buildYahooChartUrl(symbol, range);

  const res = await fetch(url, {
    headers: { "User-Agent": YAHOO_USER_AGENT },
  });

  if (!res.ok) {
    throw new Error(
      `無法連線至 Yahoo Finance（「${symbol}」）：${res.status} ${res.statusText}`,
    );
  }

  const data = await res.json();
  const result = data?.chart?.result?.[0];

  if (!result) {
    throw new Error(`Yahoo Finance 沒有回傳「${symbol}」的資料`);
  }

  return result;
}
