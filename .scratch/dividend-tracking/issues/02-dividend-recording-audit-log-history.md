# 02 — Dividend recording foundation: schema, add, audit log, history page

**What to build:** the user can record a dividend they received — market, symbol, payment date, after-tax amount — through a new `/dividends/new` form. Saving it resolves the historical FX rate for the payment date (same as a transaction) and writes both the `Dividend` row and a matching `CREATE` audit log entry. A new, separate `/dividends/history` page lists every dividend audit log entry, newest first, in Traditional Chinese, rendered through a new `describeDividendAuditEntry` function into a human-readable summary. This ticket is fully demoable on its own — record a dividend, then check the history page and see the corresponding entry — independent of edit/delete (Ticket 03) and of the report page showing dividend totals (Ticket 04).

**Blocked by:** None — can start immediately.

- [ ] New `Dividend` table: market, symbol, payment date, after-tax amount (original currency), the resolved FX rate, created-at
- [ ] New `DividendAuditLog` table, append-only (no update/delete ever issued against it from application code) — action (`CREATE`/`UPDATE`/`DELETE`), the affected dividend's id, before/after snapshots, created-at
- [ ] `validateDividendInput` is a pure, unit-tested function: valid input, bad date, bad market, non-positive amount
- [ ] `/dividends/new` form saves a dividend, resolving its FX rate the same way a transaction does, and writes a `CREATE` audit entry in the same database transaction as the `Dividend` row
- [ ] `describeDividendAuditEntry` is a pure, unit-tested function: a `CREATE` entry produces a one-line summary of the new dividend
- [ ] `/dividends/history` page lists every dividend audit entry newest-first, in Traditional Chinese, rendered via `describeDividendAuditEntry` — separate from `/transactions/history`
- [ ] Manually verified: recording a dividend produces a matching, correctly-worded entry on `/dividends/history`
- [ ] `tsc --noEmit`, `eslint`, and the full test suite pass
