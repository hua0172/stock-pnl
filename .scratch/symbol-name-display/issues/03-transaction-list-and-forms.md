# 03 — Transaction list + add/edit forms show symbol names

**What to build:** The transaction list page displays `名稱（代號）` for each row's symbol. The add-transaction and edit-transaction forms show the matched name live, right after the user finishes typing a symbol (on blur).

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Transaction list page fetches names for its distinct symbols and formats each row's symbol cell
- [ ] New `lookupSymbolName(market, symbol)` Server Action resolves a single symbol's name, reusing the infrastructure from ticket 01
- [ ] Add-transaction form: after the symbol field loses focus, the resolved name appears next to it (or nothing, if unmatched)
- [ ] Edit-transaction form: same behavior, including when the user changes the symbol to something different from what's currently stored
- [ ] A failed or unmatched name lookup never blocks saving the transaction — verified manually by entering a nonexistent symbol and confirming the save still succeeds
- [ ] Verified manually in the browser
