# 05 — Dividend list + add/edit forms show symbol names

**What to build:** Mirrors ticket 03, for dividends: the dividend list page displays `名稱（代號）`, and the add/edit dividend forms show the matched name live on blur.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Dividend list page fetches names for its distinct symbols and formats each row's symbol cell
- [ ] Add-dividend form: after the symbol field loses focus, the resolved name appears next to it (reusing the `lookupSymbolName` Server Action — or introducing it here first, if ticket 03 hasn't landed yet)
- [ ] Edit-dividend form: same behavior, including when the symbol is changed
- [ ] A failed or unmatched name lookup never blocks saving the dividend
- [ ] Verified manually in the browser
