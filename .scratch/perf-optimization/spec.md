Status: ready-for-agent

# Performance Optimization: TW Symbol Name Caching + Report Page Parallelization

## Problem Statement

Every page that displays symbol names (report page, transaction list, dividend list, both audit-log history pages) calls `fetchTwSymbolNames()`, which does a fresh, uncached bulk fetch of the entire TWSE (~1400 rows) and TPEx (~1000 rows) securities lists on every single page load. Direct timing of these endpoints shows TWSE alone regularly taking 4–6 seconds to respond, and this cost is paid again on every request even though the underlying data (company/fund names) essentially never changes. This is the dominant contributor to page load times measured at 1.2–2.6+ seconds across the app.

Separately, the report page (`/`) fetches current prices/FX rates and symbol names sequentially, even though the two are independent of each other and could be fetched concurrently.

## Solution

Cache the resolved TW symbol-name map in memory for 24 hours, refreshing only when stale, and never letting a failed refresh attempt clobber good cached data. Kick off the report page's symbol-name fetch concurrently with its price/FX fetch, awaiting it only where it's actually needed, instead of fetching it afterward.

Price and FX rate lookups remain live/uncached (explicitly confirmed) — this feature only caches the TW name list and reorders independent work on the report page.

## User Stories

1. As the user, I want pages that show stock names to load quickly on repeat visits, without waiting for a multi-second TWSE/TPEx re-download every time.
2. As the user, I want the TW name cache to refresh automatically after 24 hours, so a newly listed stock's name eventually shows up without needing a server restart.
3. As the user, I want a temporary TWSE/TPEx outage during a cache refresh to keep serving the last known-good names rather than blanking out every TW stock's name for the next 24 hours.
4. As the user, I want the report page to fetch prices/FX and symbol names at the same time instead of one after the other, shaving off the portion of load time that was pure waiting on two independent, unrelated network calls.
5. As the user, I want no change to how current price or FX rate data is fetched — those must stay live on every page load.

## Implementation Decisions

- **New pure seam**: `isCacheFresh(fetchedAt: number, ttlMs: number, now: number): boolean` in `src/lib/symbol-name.ts` — returns whether a cache entry recorded at `fetchedAt` is still within `ttlMs` of `now`. This is the one decision worth isolating and testing; the caching wrapper itself (module-level mutable state, network calls) follows this repo's existing convention of being verified manually rather than unit tested, consistent with how `fetchTwSymbolNames`'s own network calls are already handled.
- **Module-level in-memory cache** in `src/lib/symbol-name.ts`, wrapping the existing `fetchTwSymbolNames()` fetch logic: a single cache entry (`{ names: Map<string, string>; fetchedAt: number }`) shared across all requests within the running server process (dev via the existing LaunchAgent, or a production process) — a plain module-scoped variable, not Next.js's fetch-cache mechanism, for predictability and to mirror the iOS app's existing actor-based in-memory cache for the same data (`SymbolNameService`).
- **TTL**: 24 hours (`TW_NAME_CACHE_TTL_MS`).
- **Fail-open on refresh failure**: if the cache is stale and a refresh is attempted, only replace the cached entry when the new fetch result is non-empty. A refresh that comes back empty (e.g. both TWSE and TPEx timed out) leaves the existing stale-but-good cache in place and serves it, rather than overwriting good data with an empty result — this is the same fail-open principle already applied throughout `symbol-existence.ts` and `fetchTwSymbolNames`'s own timeout handling, extended to the cache layer.
- **No change** to `fetchUsSymbolName`, `fetchCurrentPrice`, or `fetchCurrentFxRate` — those remain uncached, per explicit decision.
- **Report page (`src/app/page.tsx`)**: start the `fetchSymbolNames(...)` call before/alongside the price-fetching `Promise.allSettled` block (not awaited immediately), and only `await` its result at the point it's actually consumed (right before `calculatePnl`/rendering). The FX-rate-per-market loop and price-fetching logic are otherwise unchanged — this is purely reordering an already-independent call to run concurrently, not a restructure of the price/FX fetching itself.
- **Downstream benefit, no code change needed**: `symbol-existence.ts`'s `checkTwOpenData` already calls `fetchTwSymbolNames()` directly, so it automatically benefits from the new cache without modification.

## Testing Decisions

- `isCacheFresh` gets direct unit tests in `src/lib/symbol-name.test.ts` (new or extended file): fresh just inside the TTL, stale just past it, and the boundary exactly at `ttlMs`.
- No dedicated tests for the cache wrapper itself or the report page's fetch reordering — verified manually (timing the report page and a symbol-name-displaying page before/after, confirming a second load within 24 hours is fast, and confirming behavior is unchanged when the cache is empty/expired).
- No tests for price/FX fetching — unchanged.

## Out of Scope

- Caching or altering current price or FX rate fetching (explicitly kept live).
- Any change to `fetchUsSymbolName` (US names were not identified as part of the bottleneck; TWSE/TPEx are TW-only).
- Parallelizing the FX-rate-per-market loop internally, or the price-fetch/FX-fetch phases relative to each other — only the symbol-name fetch is being moved to run concurrently with the rest.
- Any change to the other pages (`/transactions`, `/dividends`, both history pages) beyond the automatic speedup they inherit from the shared `fetchTwSymbolNames()` cache — none of them have a sequential-phases problem like the report page does.

## Further Notes

- Motivated by direct timing measurements taken during this investigation: TWSE endpoint 4.6–5.9s across three direct requests; TPEx mostly ~0.5–0.6s but once 5.4s; report page 1.28–2.64s; other symbol-name-displaying pages 1.17–2.06s.
- User confirmed: cache TW names for 24 hours (not "until restart", not a shorter window); do not cache prices/FX; do parallelize the report page's independent fetches.
