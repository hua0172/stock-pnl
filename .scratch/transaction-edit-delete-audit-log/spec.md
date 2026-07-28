Status: ready-for-agent

# Transaction Edit/Delete + Audit Log

## Problem Statement

The app currently only supports adding transactions — there's no way to fix a typo (wrong date, price, quantity) or remove a duplicate/mistaken entry without editing the SQLite database by hand. This is a real gap for a system meant for ongoing personal bookkeeping. The user is also wary of losing traceability once edit/delete exist: they want to be able to look back and see what changed and when, and — critically — to be able to tell "I actually sold here" (a real trading event) apart from "I fixed a typo three days later" (a correction to the record of that event, not a new one).

## Solution

Add a new `/transactions` page listing every individual transaction with edit and delete actions. Editing reuses the same validation as creating a transaction (extracted into a shared `validateTransactionInput` function), re-resolving the historical FX rate whenever trade date or market changes. Deleting requires a confirmation prompt. Every create, edit, and delete writes an entry to a new, append-only `TransactionAuditLog` table capturing the action type and the transaction's before/after state; a new `/transactions/history` page lists these entries in human-readable form (via a new `describeAuditEntry` function), making it clear at a glance which entries are corrections (UPDATE/DELETE) versus original entries (CREATE). The audit log is purely for the user's own review — it is never read by `calculatePnl`, which continues to operate solely on the live Transaction table exactly as today.

## User Stories

1. As the user, I want a page listing every individual transaction (not just the per-stock summary), so that I can find the specific entry I need to fix.
2. As the user, I want to edit any field of an existing transaction (date, market, symbol, side, quantity, price), so that I can correct a data-entry mistake without deleting and re-adding it.
3. As the user, I want editing to use the exact same validation rules as adding a new transaction, so that an editing mistake can't slip through where creation would have caught it.
4. As the user, I want the historical FX rate to be automatically re-resolved whenever I change a transaction's trade date or market, so that an edited transaction's exchange rate always matches its (possibly new) date rather than silently keeping a stale rate.
5. As the user, I want to delete a transaction entirely, so that I can remove a duplicate or mistaken entry.
6. As the user, I want a confirmation prompt before a delete actually happens, so that I don't lose a transaction to a misclick.
7. As the user, I want every create, edit, and delete to be recorded in an audit log, so that I have a permanent trail of what changed and when.
8. As the user, I want a dedicated page listing the audit log in human-readable form, so that I can review my own history without inspecting the database.
9. As the user, I want the audit log to clearly distinguish a correction (an edit or delete of an existing transaction) from an original entry (a create), so that I don't mistake "I fixed a typo" for "I made another real trade."
10. As the user, I want the audit log entry for an edit to show what specifically changed (e.g. "price: 500 → 550"), so that I can see exactly what was corrected without comparing two full records myself.
11. As the user, I want the audit log entry for a delete to preserve a full snapshot of the deleted transaction, so that the record of what I removed isn't lost even though the live transaction is gone.
12. As the user, I want the audit log to be append-only — no editing or deleting audit log entries themselves — so that the history I'm relying on can't itself be silently rewritten.
13. As the user, I want my report page's P&L numbers to always reflect only the current, live set of transactions (exactly as they do today), so that editing or deleting a transaction updates my P&L correctly without any new calculation logic being needed.
14. As the user, I want the realized P&L from a corrected (edited) sell transaction to reflect the corrected values, not the original mistaken ones, since a correction isn't a new sale — it's fixing the record of the one that already happened.
15. As the user, I want the transactions list page to show enough detail per row (date, market, symbol, side, quantity, price) to identify the right transaction to edit or delete, without cross-referencing the report page.
16. As the user, I want the new `/transactions` and `/transactions/history` pages to be in Traditional Chinese, consistent with the rest of the app.
17. As the user, I want the app to keep working correctly (existing add/import/report functionality unaffected) after this change, so that this feature is additive, not a regression.

## Implementation Decisions

- **New Prisma model `TransactionAuditLog`**:
  - `id` (String, cuid)
  - `action` (enum: `CREATE` / `UPDATE` / `DELETE`)
  - `transactionId` (String — the affected Transaction's id; not a DB foreign key, since a DELETE's transaction row no longer exists afterward)
  - `before` (Json, nullable — the full prior Transaction state; `null` for CREATE)
  - `after` (Json, nullable — the full new Transaction state; `null` for DELETE)
  - `createdAt` (DateTime, default now)
  - Append-only: no update or delete operation is ever performed against this table from application code.
- **`src/lib/transaction-input.ts`** (new): `validateTransactionInput(input) -> { value: TransactionInput } | { error: string }`, extracted from `addTransaction`'s existing inline validation (trade-date pattern, market ∈ {TW,US}, side ∈ {BUY,SELL}, positive quantity/price). Both `addTransaction` and the new `updateTransaction` Server Action call this — a single validation path instead of two hand-kept copies.
- **`src/lib/audit-log.ts`** (new): `describeAuditEntry(entry) -> { actionLabel: string, summary: string }` — pure function producing the human-readable action label (新增／編輯／刪除) and a diff-style summary of what changed. For `UPDATE`, a per-field before→after list restricted to fields that actually changed; for `CREATE`/`DELETE`, a one-line description of the full transaction.
- **Server Actions** (`src/app/actions.ts`): new `updateTransaction(id, formData)` and `deleteTransaction(id)`. Both:
  1. Validate input via `validateTransactionInput` (update only).
  2. Re-resolve the FX rate via `fetchHistoricalFxRate` whenever trade date or market changes (update only).
  3. Perform the Transaction write (update or delete) and the corresponding `TransactionAuditLog` write inside a single `prisma.$transaction`, so a partial failure can't leave a mutation without its audit entry, or vice versa.
  4. `revalidatePath` the report, transactions, and history pages.
- **New page `/transactions`**: lists every Transaction (all fields), each row with 編輯/刪除 actions. Edit reuses the same field set as `/transactions/new`, pre-filled with the transaction's current values. Delete triggers a confirmation prompt before calling `deleteTransaction`.
- **New page `/transactions/history`**: lists every `TransactionAuditLog` entry, newest first, rendered via `describeAuditEntry`.
- **No change to `calculatePnl`, the Transaction schema's existing fields, or the report page's data flow** — P&L continues to read only the live Transaction table, exactly as today.
- **Domain glossary**: `CONTEXT.md` gains an **Audit Log Entry** (異動紀錄) term. The existing **Realized P&L** entry is clarified: "later transactions" never retroactively change a past realized figure, but a *correction* to the transaction that produced it (an edit or delete of that transaction itself) does — a correction isn't a later event, it's fixing the record of the one that already happened.
- A "hard delete + separate append-only audit log, not soft-delete" ADR is likely warranted (mirrors the reasoning already surfaced during grilling) — write it during implementation if it clears the ADR bar (hard to reverse / surprising / real trade-off).

## Testing Decisions

- Two new pure-function seams, extending this project's existing pattern (test pure logic; verify Server Actions and pages manually in the browser):
  - **`validateTransactionInput`**: valid input → `{ value }`; each invalid case (bad date, bad market, bad side, non-positive quantity, non-positive price) → the matching `{ error }` message. This formalizes and relocates the validation coverage that today lives inline in `addTransaction`, rather than adding net-new rules.
  - **`describeAuditEntry`**:
    - a `CREATE` entry produces a one-line "new transaction" summary
    - an `UPDATE` entry with a single changed field (e.g. price) names that field's before→after values
    - an `UPDATE` entry with multiple changed fields lists all of them
    - a `DELETE` entry produces a summary of the deleted transaction's full details
- No dedicated tests for the Server Actions or the two new pages — verified manually in the browser (add, edit, delete, confirmation dialog, audit log entries appearing correctly), consistent with how `addTransaction`/`importTransactionsCsv` were verified originally.

## Out of Scope

- Soft-delete / undo — deletes are permanent; the audit log preserves what was deleted, but there is no "restore" button.
- Any P&L-delta display on the audit log itself (e.g. "this edit changed your P&L by X") — explicitly discussed and rejected during grilling; the audit log shows what changed in the transaction, not its downstream P&L effect.
- Editing or deleting audit log entries themselves.
- Bulk edit/delete, or editing/deleting directly from the CSV import flow.
- Any change to how CSV import or manual "add transaction" work today.

## Further Notes

- Because deletes are hard deletes, a Transaction's `id` is not reused after deletion — a `DELETE` entry's `transactionId` refers to an id no longer present in the Transaction table, which is expected and by design; the full snapshot in `before` is what makes that entry self-contained.
- If a future need arises to compute "what my P&L looked like at a past point in time," the audit log's per-entry snapshots are sufficient raw material for that — but building that view is explicitly out of scope here.
