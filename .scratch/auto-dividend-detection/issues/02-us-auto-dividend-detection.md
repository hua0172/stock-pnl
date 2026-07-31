# 02 — US auto dividend detection

**What to build:** Extends the same daily scan built in ticket 01 to also cover US-listed holdings, using Yahoo Finance's existing chart endpoint with dividend events enabled. Same end-to-end behavior as ticket 01 (auto-create, holdings-as-of-date, no duplicates, editable/deletable), just for the US market.

**Blocked by:** 01 — TW auto dividend detection (reuses its schema, gate, and orchestration).

**Status:** ready-for-agent

- [ ] `buildYahooChartUrl` (or an equivalent) supports requesting dividend events (`events=div`) alongside the existing price-chart usage, without changing behavior for existing callers that don't request it.
- [ ] A function fetches ex-dividend events for a given US symbol via this endpoint over a rolling window (e.g. `3mo`), parsing the returned dividend events into the same `{ symbol, exDate, cashDividendPerShare }` shape used for TW.
- [ ] The orchestration function from ticket 01 is extended to also fetch US events for every distinct US symbol ever transacted, applying the same `quantityHeldAsOf` / already-recorded / fail-open rules already built for TW.
- [ ] Manually verified: a held US symbol with a real recent/upcoming dividend event gets a correctly-amounted `Dividend` row (original-currency amount × historical FX rate) after a report-page load; reloading the same day does not duplicate it.
