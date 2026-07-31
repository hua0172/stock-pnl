# 01 — TW auto dividend detection

**What to build:** Opening the report page automatically checks (at most once a day, via a persisted marker) for any TW-listed holding with an ex-dividend event in TWSE/TPEx's rolling near-term window, and auto-creates a `Dividend` record — using the shares actually held as of that event's date — for any event not already recorded. This ticket builds the full pipeline (schema, holdings-as-of-date calculation, daily-scan gate, TW data fetch/filter, orchestration, report-page wiring) end to end for TW; US support is added in the next ticket on top of this same pipeline.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] `quantityHeldAsOf(transactions, asOfDate)` is added to `pnl.ts` and unit tested: only counts transactions on/before the cutoff, ignores later buys/sells, handles a full sell down to (epsilon-tolerant) zero.
- [ ] `shouldRunDailyScan(lastRunDate, today)` is added and unit tested: `null` → true, same day → false, an earlier day → true.
- [ ] New `DividendScanState` singleton table persists the last-run date across server restarts.
- [ ] A pure TW row-filtering function normalizes raw TWSE (`TWT48U_ALL`) and TPEx (`tpex_exright_prepost`) rows into `{ symbol, exDate, cashDividendPerShare }` events, unit tested: a cash-bearing row (`息`/`除息`, or `權息`/`除權息`) with a cash amount is kept; a rights-only row (`權`/`除權`) is dropped regardless of amount; a cash-type row with a blank/zero amount is dropped.
- [ ] `createDividend` is exported from `dividend-actions.ts` for reuse (no behavior change to the manual add/edit flow).
- [ ] An orchestration function fetches TW ex-dividend events, and for every distinct TW symbol ever transacted (not just currently-held), computes `quantityHeldAsOf` at the event's date, skips if not positive or if a `Dividend` already exists for that `(symbol, market, paymentDate)`, and otherwise creates one via the shared `createDividend` (historical FX rate included).
- [ ] The report page runs this scan (gated by `shouldRunDailyScan`) before its own dividend query, so newly created records show up in that same page load; a scan failure is caught and surfaced the same way existing price/FX errors are, never crashing the page.
- [ ] Manually verified: a held TW symbol with a real upcoming/recent ex-dividend event gets a correctly-amounted `Dividend` row after a report-page load; reloading the same day does not duplicate it; a symbol with zero holdings as of the event's date is skipped; the new record is editable/deletable exactly like a manually-entered one.
