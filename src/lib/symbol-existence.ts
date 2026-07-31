import { toYahooSymbolCandidates } from "./market";
import type { Market } from "./pnl";
import { fetchTwSymbolNames } from "./symbol-name";

export interface SourceLookup {
  responded: boolean;
  found: boolean;
}

export interface SymbolExistenceResult {
  exists: boolean;
  confirmedAbsent: boolean;
}

// The one pure, tested seam this feature centers on. A source that didn't
// respond contributes nothing either way — it must never turn into a
// negative signal, so a single flaky data source can never block a save on
// its own. Only blocks (confirmedAbsent) when every consulted source
// responded and none of them found it. An empty source list is explicitly
// treated as undetermined, not confirmed absent — [].every(...) is
// vacuously true in JS, which would otherwise silently block everything.
export function resolveSymbolExistence(sources: SourceLookup[]): SymbolExistenceResult {
  if (sources.length === 0) {
    return { exists: false, confirmedAbsent: false };
  }

  const exists = sources.some((s) => s.responded && s.found);
  const allResponded = sources.every((s) => s.responded);
  const confirmedAbsent = allResponded && !exists;

  return { exists, confirmedAbsent };
}

// These bulk endpoints never legitimately return zero rows when the
// connection succeeds, so a non-empty map is a reasonable proxy for "at
// least one of TWSE/TPEx responded" — there's no per-symbol status code to
// consult the way there is for Yahoo below.
async function checkTwOpenData(symbol: string): Promise<SourceLookup> {
  const names = await fetchTwSymbolNames();
  return { responded: names.size > 0, found: names.has(symbol) };
}

// Deliberately a fresh, low-level fetch rather than reusing fetchYahooChart
// (which throws a single Error type for both a real "no such symbol" 404
// and an ambiguous network/rate-limit failure, losing the distinction this
// feature needs). A 404 is Yahoo's own definitive "not found" answer; any
// other non-ok status (429 rate-limited, 5xx, etc.) or a thrown network
// error is treated as "didn't respond" — ambiguous, never a negative signal.
async function fetchYahooExistence(yahooSymbol: string): Promise<SourceLookup> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?range=1d&interval=1d`,
      { headers: { "User-Agent": "Mozilla/5.0" } },
    );

    if (res.status === 404) {
      return { responded: true, found: false };
    }
    if (!res.ok) {
      return { responded: false, found: false };
    }

    const data = await res.json();
    const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;

    if (typeof price === "number") {
      return { responded: true, found: true };
    }
    // A 200 response whose own body says "no result" is still Yahoo giving
    // a definitive answer, just a negative one.
    return { responded: true, found: false };
  } catch {
    return { responded: false, found: false };
  }
}

async function checkYahooExists(market: Market, symbol: string): Promise<SourceLookup> {
  const candidates = toYahooSymbolCandidates(market, symbol);
  const results = await Promise.all(candidates.map(fetchYahooExistence));

  if (results.some((r) => r.found)) {
    return { responded: true, found: true };
  }
  if (results.every((r) => r.responded)) {
    // Every candidate (.TW and, for TW, .TWO) gave a definitive "no."
    return { responded: true, found: false };
  }
  return { responded: false, found: false };
}

export async function verifySymbolExists(
  market: Market,
  symbol: string,
): Promise<SymbolExistenceResult> {
  if (market === "US") {
    return resolveSymbolExistence([await checkYahooExists(market, symbol)]);
  }

  const [twOpenData, yahoo] = await Promise.all([
    checkTwOpenData(symbol),
    checkYahooExists(market, symbol),
  ]);

  return resolveSymbolExistence([twOpenData, yahoo]);
}
