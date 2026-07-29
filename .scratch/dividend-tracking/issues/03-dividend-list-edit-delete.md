# 03 — Dividend list page: edit and delete

**What to build:** a new `/dividends` page lists every individual dividend record (payment date, market, symbol, amount), each row with 編輯 (edit) and 刪除 (delete) actions, mirroring `/transactions`. Editing reuses `validateDividendInput` and re-resolves the historical FX rate whenever the payment date or market changes, pre-filled with the record's current values. Deleting requires a confirmation prompt before it happens (permanent, hard delete — no undo, same as transactions). Both actions write a matching entry (`UPDATE` or `DELETE`) to `DividendAuditLog`, visible on `/dividends/history`.

**Blocked by:** Ticket 02 (edit reuses `validateDividendInput`; edit/delete write into the audit log and schema built there).

- [ ] `/dividends` page lists every dividend record with enough detail to identify the right one, each row with 編輯/刪除
- [ ] Edit form reuses `validateDividendInput`, pre-filled with the record's current values
- [ ] Editing a dividend's payment date or market re-resolves the historical FX rate; editing neither leaves the stored rate untouched
- [ ] Delete shows a confirmation prompt before the record is actually removed
- [ ] Every successful edit writes an `UPDATE` audit entry naming the specific fields that changed
- [ ] Every successful delete writes a `DELETE` audit entry with the full deleted record's snapshot
- [ ] Manually verified in the browser: edit a dividend (including changing its date to trigger FX re-resolution), delete a dividend (confirming the prompt appears), and see both reflected correctly on `/dividends/history`
- [ ] `tsc --noEmit`, `eslint`, and the full test suite pass
