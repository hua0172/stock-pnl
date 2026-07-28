# 03 — Rewrite the entire app's UI text in Traditional Chinese

**What to build:** every user-facing string in the app — the report page (headers, table column labels, buttons, the empty-state message, the data-error banner), the "Add transaction" form (field labels, placeholders, the submit button, validation error messages returned from the Server Action), and the CSV import page (instructions, the expected-columns example, the submit button, and per-row import error messages) — is rewritten directly in Traditional Chinese. No language switcher, no i18n library (see ADR-0005) — this is a direct, permanent rewrite of the existing English strings.

Keep terminology consistent with the domain glossary already in `CONTEXT.md` (e.g. use the same Chinese term for "Realized P&L" everywhere it appears, rather than letting phrasing drift page to page).

**Blocked by:** None — can start immediately. (Note: this ticket and Ticket 02 both touch the report page file; if worked in parallel, sequence one after the other to avoid clobbering each other's edits.)

- [ ] Report page: all headers, table column labels, buttons, empty-state text, and the data-error banner are in Chinese
- [ ] "Add transaction" form: all field labels, placeholders, the submit button, and every validation error message are in Chinese
- [ ] CSV import page: instructions, the expected-columns example text, the submit button, and every per-row import error message are in Chinese
- [ ] Terminology matches `CONTEXT.md`'s existing Chinese glossary terms (報酬率, 持股占比, etc. where applicable) consistently across all three pages
- [ ] No English UI copy remains on any of the three pages
- [ ] Verified manually in the browser: report page, add-transaction form (including a triggered validation error), and CSV import (including a per-row error) all display correctly in Chinese
- [ ] `tsc --noEmit`, `eslint`, and the full test suite still pass
