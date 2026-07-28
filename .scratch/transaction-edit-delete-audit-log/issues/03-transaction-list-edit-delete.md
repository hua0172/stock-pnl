# 03 — Transaction list page: edit, delete, and their audit entries

**What to build:** a new `/transactions` page lists every individual transaction (date, market, symbol, side, quantity, price), each row with 編輯 (edit) and 刪除 (delete) actions. Editing reuses the same fields and validation as adding a transaction (via Ticket 01's `validateTransactionInput`), pre-filled with the transaction's current values, and automatically re-resolves the historical FX rate whenever the trade date or market changes. Deleting requires a confirmation prompt before it happens (it's a permanent, hard delete — there's no undo). Both actions write a matching entry (`UPDATE` or `DELETE`) to the audit log built in Ticket 02, so every edit and delete shows up on `/transactions/history` — an edit's entry names exactly which fields changed (e.g. "價格：500 → 550"), and a delete's entry preserves the full snapshot of what was removed. The report page's P&L numbers are unaffected in how they're calculated — they simply reflect whatever the live transaction table currently contains, same as today.

**Blocked by:** Ticket 01 (edit reuses `validateTransactionInput`), Ticket 02 (edit/delete write into the audit log and its schema/history page must already exist).

- [ ] `/transactions` page lists every transaction with enough detail to identify the right one, each row with 編輯/刪除
- [ ] Edit form reuses the same fields and validation as `/transactions/new`, pre-filled with current values
- [ ] Editing a transaction's trade date or market re-resolves the historical FX rate; editing neither leaves the stored rate untouched
- [ ] Delete shows a confirmation prompt before the transaction is actually removed
- [ ] Every successful edit writes an `UPDATE` audit entry naming the specific fields that changed
- [ ] Every successful delete writes a `DELETE` audit entry with the full deleted transaction's snapshot
- [ ] The report page's P&L reflects an edited or deleted transaction correctly, with no changes needed to `calculatePnl` itself
- [ ] `describeAuditEntry`'s `UPDATE` (single field changed, multiple fields changed) and `DELETE` cases are unit-tested
- [ ] Manually verified in the browser: edit a transaction (including changing its date to trigger FX re-resolution), delete a transaction (confirming the prompt appears), and see both reflected correctly on `/transactions/history` and the report page
- [ ] `tsc --noEmit`, `eslint`, and the full test suite pass
