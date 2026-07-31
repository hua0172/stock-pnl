# 02 — Report page parallel fetch

**What to build:** The report page (`/`) starts fetching symbol names at the same time it starts fetching current prices/FX rates, instead of waiting for prices/FX to finish first. The two are independent, so total wait time drops by roughly whichever phase is faster, instead of summing both.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] `fetchSymbolNames(...)` is kicked off before/alongside the price-fetching `Promise.allSettled` block on the report page, and only awaited at the point its result is actually consumed.
- [ ] Price-fetching and the per-market FX-rate loop are otherwise unchanged (no new parallelization within that existing logic).
- [ ] Manually verified: report page renders the same data (byStock table, charts, symbol labels) as before, and total load time improves relative to the sequential baseline.
