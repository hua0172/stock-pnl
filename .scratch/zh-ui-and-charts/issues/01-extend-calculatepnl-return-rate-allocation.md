# 01 — Extend calculatePnl with Return Rate, Market Value, and Allocation fields

**What to build:** `calculatePnl` (the existing pure-function seam in `src/lib/pnl.ts`) computes three new derived values per Holding, using data it already has — no new inputs, no I/O:

- **Return Rate** (報酬率): Total P&L as a percentage of cost basis. `null` for a fully-closed Holding (zero quantity held), since there's no cost basis to divide by.
- **Market Value** (TWD): current price × current FX rate × quantity held. `null` when quantity held is zero, or when either the current price or current FX rate is unavailable for that Holding.
- **Holding Allocation** (持股占比): a Holding's Market Value as a percentage of the sum of every Holding's Market Value. `null` under the same conditions as Market Value, or when the total Market Value across all Holdings is zero. Critically, a Holding excluded from Market Value (e.g. because its live price couldn't be fetched) must also be excluded from the *denominator* used to compute every other Holding's allocation — not silently treated as contributing zero.

This is a self-contained data-layer change: no UI, no new external calls, verified entirely through unit tests.

**Blocked by:** None — can start immediately.

- [ ] `StockPnl` gains `returnRatePercent: number | null`, `marketValueTwd: number | null`, and `allocationPercent: number | null`
- [ ] A Holding with quantity held > 0 gets a non-null `returnRatePercent` matching an independently-computed literal (not recomputed the same way the code does)
- [ ] A fully-closed Holding (quantity held = 0) gets `returnRatePercent: null`, `marketValueTwd: null`, and `allocationPercent: null`
- [ ] Two Holdings with known current prices get `allocationPercent` values that sum to 100 (within floating-point tolerance) and are proportional to their respective Market Values
- [ ] A Holding whose current price is unavailable gets `marketValueTwd: null` and `allocationPercent: null`, and does not affect the other Holdings' `allocationPercent` (excluded from the total, not counted as zero within it)
- [ ] Full existing test suite (`pnl.test.ts`, `csv.test.ts`) still passes
- [ ] `tsc --noEmit` and `eslint` both pass clean
