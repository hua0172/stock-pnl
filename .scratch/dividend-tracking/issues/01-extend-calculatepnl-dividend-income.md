# 01 — Extend calculatePnl with Dividend Income

**What to build:** `calculatePnl` (`src/lib/pnl.ts`) gains a new `dividends` parameter — a list of per-record dividend data (symbol, market, amount, fxRate). For each symbol, it sums `amount × fxRate` across all of that symbol's dividend records into a new `dividendTwd` field on `StockPnl`. `totalPnlTwd` becomes `realizedPnlTwd + unrealizedPnlTwd + dividendTwd`; `returnRatePercent`'s formula itself is unchanged but now reflects dividends automatically since it reads the extended `totalPnlTwd`. `overview` gains a `dividendTwd` sum across all stocks, and `overview.totalPnlTwd` extends the same way. This is a self-contained data-layer change: no UI, no database, no new external calls — verified entirely through unit tests, same as the Return Rate / Holding Allocation extension before it.

**Blocked by:** None — can start immediately.

- [ ] `StockPnl` gains `dividendTwd: number` — always a number, never `null` (unlike `marketValueTwd`/`returnRatePercent`/`allocationPercent`, since it doesn't depend on live market data)
- [ ] A stock with one dividend record: `dividendTwd` equals `amount × fxRate`, and `totalPnlTwd`/`returnRatePercent` include it
- [ ] A stock with multiple dividend records: `dividendTwd` sums all of them
- [ ] A stock with no dividend records: `dividendTwd` is `0`, and every other field's behavior is unchanged from before this ticket
- [ ] A closed holding (quantity held = 0) with historical dividend income: `dividendTwd` still reflects the total, even though `returnRatePercent` stays `null` for closed holdings per existing behavior
- [ ] `overview.dividendTwd` and `overview.totalPnlTwd` correctly sum across multiple stocks
- [ ] Full existing test suite still passes
- [ ] `tsc --noEmit` and `eslint` both pass clean
