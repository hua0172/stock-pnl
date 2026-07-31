# 04 — Form hint warning for an unresolved symbol

**What to build:** `SymbolMarketFields`'s existing blur-triggered name lookup (from symbol-name-display) already shows nothing when no name resolves. Add a small, clearly non-blocking warning text in that same case (e.g. "查無此代號的名稱資料，請確認是否正確"), reusing the existing lookup result as-is — no new cross-source logic needed, since this is advisory only and never blocks saving.

**Blocked by:** None — can start immediately (independent of tickets 01-03; reuses infrastructure that already shipped)

**Status:** ready-for-agent

- [ ] Typing a symbol with no resolvable name and blurring the field shows the warning text, verified manually in both the transaction and dividend add/edit forms
- [ ] The warning never blocks form submission — saving still succeeds regardless of whether the warning is showing
- [ ] A symbol with a resolved name shows the name as before, not the warning
