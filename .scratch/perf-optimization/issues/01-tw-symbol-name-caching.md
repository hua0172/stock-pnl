# 01 — TW symbol name caching

**What to build:** `fetchTwSymbolNames()` serves from an in-memory cache (24-hour TTL) instead of re-fetching TWSE/TPEx on every call. A failed refresh attempt (empty result) never overwrites good cached data — the stale-but-good cache keeps being served until a refresh actually succeeds. Any page that displays TW stock names (report, transactions, dividends, both history pages) loads fast on repeat visits within the TTL window; the existence-guard's TW check inherits the same speedup automatically since it calls the same function.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] `isCacheFresh(fetchedAt, ttlMs, now)` is added as a pure, unit-tested function (fresh just inside TTL, stale just past it, boundary at exactly `ttlMs`).
- [ ] `fetchTwSymbolNames()` wraps its existing fetch logic with a module-level `{ names, fetchedAt }` cache entry, checked via `isCacheFresh` against a 24-hour TTL.
- [ ] A stale cache triggers a refresh; if the refresh result is empty, the previous cached entry is kept and returned instead of the empty result.
- [ ] A successful refresh (non-empty result) replaces the cached entry and resets `fetchedAt`.
- [ ] No behavior change to `fetchUsSymbolName`, `fetchCurrentPrice`, or `fetchCurrentFxRate`.
- [ ] Manually verified: a second load of a name-displaying page within 24 hours of the first is noticeably faster than the current baseline (1.2–2.6s), and a cold/expired cache still resolves names correctly.
