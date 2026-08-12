# 01 — Normalize symbol casing at input validation

**What to build:** Whenever the user enters a stock symbol — creating or editing a transaction, creating or editing a dividend, or importing via CSV — the saved symbol is normalized to uppercase, regardless of the letter case it was typed in. This closes the bug where the same real-world symbol entered with inconsistent casing (e.g. "VOO" vs "Voo") gets treated as two unrelated holdings across the report, the oversell guard, automatic dividend detection, symbol-existence verification, and the symbol-name cache — all of which compare symbols by exact string equality and become correct automatically once the input they receive is already normalized. No changes are needed in any of those downstream modules.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] A transaction's symbol is uppercase-normalized on save (create and edit), immediately after the existing whitespace-trim step
- [ ] A dividend's symbol is uppercase-normalized on save (create and edit), immediately after the existing whitespace-trim step
- [ ] CSV-imported transactions are normalized too — the CSV parser has its own symbol-extraction step (it does not call the transaction validator), so it needs its own normalization fix
- [ ] The existing transaction-input validator test suite gains a case: a mixed-case symbol (e.g. "Voo") is normalized to uppercase ("VOO") in the returned value
- [ ] The existing dividend-input validator test suite gains the equivalent case
- [ ] The existing CSV parser test suite gains the equivalent case
- [ ] No changes made to the report's per-symbol grouping, the oversell guard, `calculatePnl`, dividend detection, the symbol-existence guard, or the symbol-name cache — verify their existing tests still pass unmodified
- [ ] Verified manually: entering the same symbol in two different cases (e.g. via the transaction form) results in one merged holding in the report, not two
