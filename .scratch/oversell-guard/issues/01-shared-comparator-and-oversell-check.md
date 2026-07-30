# 01 — Shared chronological comparator + `findOversellViolation`

**What to build:** Extract `calculatePnl`'s existing transaction sort into a shared, exported `compareTransactionsChronologically` comparator that orders by trade date and, for same-date transactions, orders `BUY` before `SELL`. `calculatePnl` switches to using this comparator (a narrow, deliberate behavior change for the same-day-multiple-transactions case). Add a new pure function, `findOversellViolation`, that takes a symbol's transaction list, sorts it with the shared comparator, replays quantity held transaction-by-transaction, and returns the first point a `SELL` would take it negative (symbol, trade date, available quantity, attempted quantity) — or nothing if the sequence is valid throughout. This ticket only adds the core logic and its tests; nothing calls `findOversellViolation` yet.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] `compareTransactionsChronologically` exported from `pnl.ts`; `calculatePnl` uses it instead of its inline sort
- [ ] Existing `calculatePnl` test suite stays green (regression check — no current fixture exercises the same-day tie-break, so no behavior change expected there)
- [ ] New tests for `compareTransactionsChronologically`: different dates sort by date regardless of side; same date sorts `BUY` before `SELL`; same date and same side preserves existing relative order
- [ ] `findOversellViolation` implemented and exported
- [ ] New tests for `findOversellViolation`: no violation when sells never exceed cumulative prior buys; a violation reports the correct symbol/tradeDate/availableQuantity/attemptedQuantity; a same-day buy-then-sell is valid regardless of input array order; multiple symbols are checked independently; a fully-valid multi-transaction sequence returns nothing
