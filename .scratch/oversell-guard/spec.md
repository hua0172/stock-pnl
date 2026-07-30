Status: ready-for-agent

# Oversell Guard

## Problem Statement

Nothing currently stops a `SELL` transaction from being recorded (via manual entry, edit, or CSV import) for more shares than were actually held at that point in the transaction's chronological history. `calculatePnl` will silently let a Holding's `quantityHeld` go negative, producing nonsensical downstream figures (a negative-quantity avg cost, a negative-quantity market value, etc.) rather than catching the mistake. Deleting a transaction has the same problem in reverse — removing a `BUY` can retroactively turn an already-recorded, previously-valid `SELL` into an oversell.

## Solution

Add a `findOversellViolation` pure function that, given a symbol's full transaction list (sorted chronologically, with same-day `BUY`s ordered before same-day `SELL`s), replays `quantityHeld` and returns the first point it would go negative, or nothing if the sequence is valid throughout. Wire this into every write path that can change a symbol's transaction sequence — add, edit, delete, and CSV import — rejecting (or, for CSV import, skipping) whichever operation would introduce a violation. `calculatePnl`'s own chronological sort is updated to use the same same-day tie-break rule, so the guard and the P&L calculation are never inconsistent with each other about transaction order.

## User Stories

1. As the user, I want to be blocked from recording a `SELL` transaction for more shares than I actually held at that trade date, so I can't accidentally create a nonsensical holding.
2. As the user, I want this check to replay my full transaction history in chronological order (not just compare against today's total holding), so a backdated `SELL` that would have been invalid at the time it's dated is still caught, even if my current total holding happens to be large enough.
3. As the user, when two transactions for the same symbol share a trade date, I want same-day `BUY`s treated as happening before same-day `SELL`s, so a same-day buy-then-sell isn't incorrectly flagged as an oversell.
4. As the user, I want this same chronological ordering (date, then buys-before-sells) used by the actual P&L calculation, not just the oversell check, so the two are never inconsistent with each other about what order my transactions happened in.
5. As the user, I want editing a transaction to be checked the same way — if my edit would make the transaction sequence invalid (for the transaction's own symbol, and for its original symbol too if I changed which symbol it's for), the edit should be rejected.
6. As the user, I want deleting a transaction to be blocked if doing so would turn an already-recorded, later `SELL` into an oversell — I shouldn't be able to break my own transaction history by removing a `BUY` out from under a `SELL` that depended on it.
7. As the user, I want CSV import to check each row the same way, in file order, against both my existing transactions and whichever earlier rows in the same file already passed — a row that would cause an oversell is skipped and reported as an error, without failing the rest of the import.
8. As the user, I want a clear error message telling me the trade date, how many shares were actually available at that point, and how many I was trying to sell (or, for a blocked delete, which later transaction would become invalid).

## Implementation Decisions

- **Shared chronological comparator** (`src/lib/pnl.ts`): extract the sort `calculatePnl` already does (currently `a.tradeDate.localeCompare(b.tradeDate)` only) into an exported `compareTransactionsChronologically(a, b)` function, adding the same-day tie-break: equal `tradeDate` sorts `BUY` before `SELL`. `calculatePnl` switches to this shared comparator instead of its inline one — this is a real (if narrow) behavior change to existing P&L calculation for the same-day-multiple-transactions case, done deliberately so the guard and the calculation can never disagree about order.
- **`findOversellViolation(transactions: TransactionInput[]): OversellViolation | null`** (new, `src/lib/pnl.ts`): groups the input by symbol, sorts each group with `compareTransactionsChronologically`, and replays `quantityHeld` (starting at 0, `+= quantity` on `BUY`, `-= quantity` on `SELL`) — the moment a `SELL` would take it negative, returns `{ symbol, tradeDate, availableQuantity, attemptedQuantity }` for that transaction; returns `null` if the whole input is valid throughout. Only needs to be called with the transactions for the symbol(s) actually being touched by a given write, not the whole table.
- **`addTransaction`**: before creating, fetch existing transactions for the symbol being added, append the new one, run `findOversellViolation`. A violation returns a form error (mirroring the existing FX-rate-error pattern): `股數不足：{tradeDate} 當下持有 {availableQuantity} 股，無法賣出 {attemptedQuantity} 股`.
- **`updateTransaction`**: fetch existing transactions for the (post-edit) symbol, excluding the transaction being edited by id, append the edited version, and validate. If the edit changes which symbol the transaction belongs to, also validate the *original* symbol's remaining transactions with this transaction removed (the same check `deleteTransaction` does) — changing a transaction's symbol is, from the old symbol's perspective, equivalent to deleting it. Either failing validation blocks the save with the same error message format.
- **`deleteTransaction`**: fetch the symbol's existing transactions excluding the one being deleted, and validate. A violation blocks the delete with an error naming the later transaction that would become invalid: `無法刪除：刪除後，{tradeDate} 的賣出交易將變成超賣（當下僅剩 {availableQuantity} 股，但那筆賣出了 {attemptedQuantity} 股）`.
- **`importTransactionsCsv`**: processes rows in file order, as it already does. Before inserting each row, validate it against that symbol's existing DB transactions *plus* whichever earlier rows in this same import already succeeded for that symbol (an in-memory running list per symbol, updated as each row is accepted). A violation skips that row and appends to the existing `errors` array, in the same format already used for other per-row failures: `匯入失敗（{symbol}，{tradeDate}）：股數不足，當下持有 {availableQuantity} 股，無法賣出 {attemptedQuantity} 股`. Rows that pass continue to be inserted immediately, matching current behavior.
- **No schema changes** — this is entirely a write-time validation layer over the existing `Transaction` table; nothing new is persisted.

## Testing Decisions

- **`compareTransactionsChronologically`** (new, `pnl.test.ts`): different dates sort by date regardless of side; same date sorts `BUY` before `SELL`; same date and same side preserves stability (existing relative order).
- **`findOversellViolation`** (new, `pnl.test.ts`): no violation when sells never exceed cumulative prior buys; a violation is detected and reports the correct symbol/tradeDate/availableQuantity/attemptedQuantity; a same-day buy-then-sell is valid regardless of input array order (the comparator normalizes it); multiple symbols are checked independently (a violation in one doesn't affect another); a fully-valid multi-transaction sequence returns `null`.
- **`calculatePnl`** (existing seam): confirm the existing test suite stays green under the new shared comparator (none of the current fixtures exercise same-day multiple transactions for one symbol, so no behavior change is expected there) — this is a regression check, not new coverage.
- **Server Actions** (`addTransaction`/`updateTransaction`/`deleteTransaction`/`importTransactionsCsv`): no dedicated automated tests — verified manually in the browser (attempt an oversell via the form, via edit, via delete, and via CSV import; confirm each is blocked/skipped with the expected message), consistent with how this codebase already treats Server Actions and pages as a manually-verified layer above the tested `pnl.ts` seam.

## Out of Scope

- Any UI change beyond surfacing the new error messages through the existing error-display patterns (form error, CSV per-row error list).
- Retroactively re-validating transactions that already exist in the database from before this feature ships — the guard only applies to new writes (add/edit/delete/import) going forward; it does not scan and flag pre-existing data.
- Any change to `calculatePnl`'s actual P&L math — only its internal sort comparator changes (to fix the same-day-ordering inconsistency), not any calculation formula.
- Dividends — this guard is transaction-quantity-specific; dividend records have no analogous "oversell" concept.

## Further Notes

- The decision to also validate a transaction's *original* symbol when an edit changes its symbol (treating that case as equivalent to a delete from the old symbol's perspective) wasn't explicitly discussed in the grilling session that produced this spec, but follows directly from the same reasoning already confirmed there for plain deletes — flagging it here in case it should be revisited.
- This was synthesized from a `/grill-with-docs` session held in this same conversation — see that session for the full reasoning behind each decision (especially the same-day tie-break rule and why current-total-only checking was rejected in favor of chronological replay).
