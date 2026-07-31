import type { Market } from "./pnl";
import { fetchYahooChart } from "./yahoo";

const TWSE_STOCK_DAY_ALL_URL =
  "https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL";
const TPEX_MAINBOARD_QUOTES_URL =
  "https://www.tpex.org.tw/openapi/v1/tpex_mainboard_quotes";

interface TwseStockDayAllRow {
  Code: string;
  Name: string;
}

interface TpexMainboardQuoteRow {
  SecuritiesCompanyCode: string;
  CompanyName: string;
}

// Purely cosmetic display formatting — the one pure, tested seam this
// feature centers on. A missing name (undefined, not fetched, or unmatched)
// falls back to the bare symbol, exactly like today's behavior.
export function formatSymbolLabel(symbol: string, name: string | undefined): string {
  return name ? `${name}（${symbol}）` : symbol;
}

// Taiwan's open-data endpoints are observed to be intermittently slow to
// connect (sometimes ~500ms, sometimes exceeding undici's 10s default connect
// timeout entirely, even though the same request succeeds instantly via
// curl) — an explicit, shorter timeout keeps a bad connection from stalling
// the page this feeds into for the full default timeout. Name lookup is
// purely cosmetic, so a timeout here just means fewer names resolve.
const TW_NAME_FETCH_TIMEOUT_MS = 8000;

async function fetchJsonWithTimeout(url: string): Promise<unknown | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TW_NAME_FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: controller.signal,
    });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// Both TWSE and TPEx return their entire day's list in one response — a
// single bulk fetch covers every TW symbol, rather than one call per symbol.
// The two are independent, so fetch them in parallel rather than one after
// the other, halving the worst-case wait.
async function fetchTwSymbolNamesUncached(): Promise<Map<string, string>> {
  const names = new Map<string, string>();

  const [twseData, tpexData] = await Promise.all([
    fetchJsonWithTimeout(TWSE_STOCK_DAY_ALL_URL),
    fetchJsonWithTimeout(TPEX_MAINBOARD_QUOTES_URL),
  ]);

  if (Array.isArray(twseData)) {
    for (const row of twseData as TwseStockDayAllRow[]) {
      names.set(row.Code, row.Name);
    }
  }

  if (Array.isArray(tpexData)) {
    for (const row of tpexData as TpexMainboardQuoteRow[]) {
      if (!names.has(row.SecuritiesCompanyCode)) {
        names.set(row.SecuritiesCompanyCode, row.CompanyName);
      }
    }
  }

  return names;
}

// Company/fund names essentially never change, so re-downloading TWSE's
// ~1400 rows and TPEx's ~1000 rows on every single page load is pure waste —
// this is the dominant cost behind every page that displays a TW stock name.
const TW_NAME_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// Pure decision seam: is a cache entry recorded at `fetchedAt` still within
// `ttlMs` of `now`? Exposed so it can be tested without the network layer.
export function isCacheFresh(fetchedAt: number, ttlMs: number, now: number): boolean {
  return now - fetchedAt < ttlMs;
}

let twNameCache: { names: Map<string, string>; fetchedAt: number } | null = null;

// A single in-memory cache entry shared by every caller within this server
// process (dev via the existing LaunchAgent, or a production process) —
// deliberately a plain module-scoped variable rather than Next.js's fetch
// cache, for predictable behavior. Fail-open: a refresh that comes back
// empty (e.g. both TWSE and TPEx timed out) never overwrites a good cached
// entry — it just keeps serving the stale-but-good data until a refresh
// actually succeeds, matching the fail-open principle used throughout
// symbol-existence.ts.
export async function fetchTwSymbolNames(): Promise<Map<string, string>> {
  if (twNameCache && isCacheFresh(twNameCache.fetchedAt, TW_NAME_CACHE_TTL_MS, Date.now())) {
    return twNameCache.names;
  }

  const names = await fetchTwSymbolNamesUncached();

  if (names.size > 0) {
    twNameCache = { names, fetchedAt: Date.now() };
    return names;
  }

  return twNameCache?.names ?? names;
}

export async function fetchUsSymbolName(symbol: string): Promise<string | null> {
  try {
    const result = await fetchYahooChart(symbol, "1d");
    return result.meta.shortName ?? null;
  } catch {
    return null;
  }
}

export async function fetchSymbolNames(
  pairs: { market: Market; symbol: string }[],
): Promise<Partial<Record<string, string>>> {
  const names: Partial<Record<string, string>> = {};

  const twSymbols = pairs.filter((p) => p.market === "TW").map((p) => p.symbol);
  if (twSymbols.length > 0) {
    const twNames = await fetchTwSymbolNames();
    for (const symbol of twSymbols) {
      const name = twNames.get(symbol);
      if (name) names[symbol] = name;
    }
  }

  const usSymbols = pairs.filter((p) => p.market === "US").map((p) => p.symbol);
  const usResults = await Promise.allSettled(
    usSymbols.map(async (symbol) => ({ symbol, name: await fetchUsSymbolName(symbol) })),
  );
  for (const result of usResults) {
    if (result.status === "fulfilled" && result.value.name) {
      names[result.value.symbol] = result.value.name;
    }
  }

  return names;
}
