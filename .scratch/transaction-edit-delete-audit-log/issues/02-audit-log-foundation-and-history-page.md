# 02 — Audit log foundation: schema, CREATE logging, history page

**What to build:** every transaction created — whether via the manual "Add transaction" form or CSV import — now also writes an entry to a new, append-only audit log recording that a `CREATE` happened and the full transaction state. A new `/transactions/history` page lists every audit log entry, newest first, in Traditional Chinese, each rendered through a new `describeAuditEntry` function into a human-readable summary (e.g. "新增交易：2330，買進 100 股 @500"). This ticket is fully demoable on its own — add a transaction, then check the history page and see the corresponding entry — independent of edit/delete, which don't exist yet.

**Blocked by:** None — can start immediately.

- [ ] New `TransactionAuditLog` table: action (`CREATE`/`UPDATE`/`DELETE`), the affected transaction's id, a full snapshot of the state before the action (null for `CREATE`) and after (null for `DELETE`), and a timestamp
- [ ] No update or delete operation is ever performed against this table from application code — write-once, append-only
- [ ] `addTransaction` and CSV import both write a `CREATE` entry per transaction created
- [ ] `describeAuditEntry` is a pure, unit-tested function: a `CREATE` entry produces a one-line summary of the new transaction
- [ ] `/transactions/history` page lists every entry newest-first, in Traditional Chinese, rendered via `describeAuditEntry`
- [ ] Manually verified: adding a transaction (via form and via CSV import) produces a matching, correctly-worded entry on the history page
- [ ] `tsc --noEmit`, `eslint`, and the full test suite pass
