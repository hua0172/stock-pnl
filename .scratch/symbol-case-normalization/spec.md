Status: ready-for-agent

# Symbol Case Normalization

## Problem Statement

The user found two separate rows for the same holding in the report — "VOO" and "Voo" — because the app never normalizes a symbol's letter case. Every symbol-keyed piece of logic in the app (report grouping, the oversell guard, automatic dividend detection, symbol-existence verification, the symbol-name cache) compares symbols by exact string equality, so two differently-cased entries of the same real-world symbol are silently treated as two unrelated holdings.

## Solution

Normalize a symbol's case (uppercase) at each of the three existing input-parsing points that produce a symbol value — the transaction and dividend validation functions, and the CSV parser — the same places the app already trims whitespace from a symbol before storing it. (Corrected during implementation: CSV import parses its own rows independently rather than funneling through the transaction validator, so it needed its own normalization step too — three enforcement points, not two.) Once symbols are normalized at every point they enter the system, every downstream consumer receives already-normalized values and becomes correct without any change of its own.

## User Stories

1. As the user, I want to enter a stock symbol in any letter case (e.g. "voo", "Voo", "VOO") and have it treated as the same holding, so that a typo in casing doesn't split my position into two rows.
2. As the user, I want this normalization applied to both transactions and dividend records, so stock and dividend data don't have their own separate case-consistency bugs.
3. As the user, I want normalization to apply on both creating and editing a transaction or dividend, so that fixing a mis-cased entry by re-saving it actually merges it with the correctly-cased holding.
4. As the user, I want CSV-imported transactions to go through the same normalization, so importing a spreadsheet with inconsistent casing doesn't reintroduce the bug.
5. As the user, I want the report page's per-symbol grouping, the oversell guard, and the automatic dividend-detection scan to all naturally treat differently-cased entries of the same symbol as one holding, without needing separate fixes in each of those modules.
6. As the user, I want the stock-name lookup/cache (used to show a name like "Vanguard S&P 500 ETF" next to "VOO") to resolve to one cached name per symbol, rather than fetching and caching the same name twice under different casings.
7. As the user, I want TW symbols with letter suffixes (e.g. "00981A") to also be normalized consistently, so the same fix covers both markets, not just US tickers.
8. As the user, I want this to be a forward-looking fix only — I've already manually corrected the one existing mis-cased record in my database myself, so no automatic data migration or backfill is needed.
9. As the user, I want no additional case-insensitive comparison logic added to `groupBySymbol` or other read-side consumers, so the fix has exactly one enforcement point and stays simple.
10. As the user, I want "股票代號 (Symbol)" to become a proper glossary entry in `CONTEXT.md` documenting the uppercase-normalization rule, so future work doesn't reintroduce a case-sensitive comparison somewhere else in the codebase.

## Implementation Decisions

- The transaction-input and dividend-input validation functions each gain a case-normalization step (uppercase) applied to the symbol field, immediately after the existing whitespace-trim step.
- The CSV parser also gains the same case-normalization step where it extracts a row's symbol cell — it does not call the transaction validator, so it needed its own fix rather than inheriting one from it. With this, there are three enforcement points (transaction input, dividend input, CSV parsing), covering every place a symbol value is produced from raw user input.
- Every write path that consumes one of these three parsed/validated results (transaction create, transaction edit, dividend create, dividend edit, CSV import) receives an already-normalized symbol, so no other module needs a code change for its symbol comparisons to become case-insensitive in practice.
- No changes to the report's per-symbol grouping, the oversell guard, `calculatePnl`, the dividend-detection scan's per-market symbol set, the symbol-existence-guard's lookup functions, or the symbol-name cache — all of these become correct as a side effect of receiving only already-normalized symbol values, without any code changes of their own.
- No database schema change (no unique constraint, no case-insensitive collation) — normalization happens purely at the application validation layer, matching where the existing whitespace-trim already lives.
- No data migration or backfill script — the one existing mis-cased record in the live database was corrected manually by the user via the existing edit form, which itself will now normalize on save going forward.
- Domain glossary (`CONTEXT.md`): new **Symbol** (股票代號) entry, documenting that a symbol is always stored uppercase-normalized regardless of how it was entered, so comparisons/grouping across the codebase are effectively case-insensitive by construction.
- No ADR — this is a bug fix for an unintended gap, not an architectural trade-off worth recording.

## Testing Decisions

- The existing validator test suites (one per input type) each gain a new case: a mixed-case symbol (e.g. "Voo") is normalized to uppercase ("VOO") in the returned value. This tests external behavior (what the validator/parser returns for a given raw input), not internals.
- The CSV parser's own test suite gains the equivalent case (a mixed-case symbol cell normalizes to uppercase in the parsed row) — it is a separate seam from the transaction validator and needed its own coverage.
- Prior art: all three test suites already assert the exact shape of their function's returned value for valid input, so the new cases follow the same existing pattern.
- No new tests needed for the report grouping, the oversell guard, dividend detection, the symbol-existence guard, or the symbol-name cache — since those modules receive symbol values only through the validated/parsed write paths, their existing string-equality logic is already correct once given normalized input. Adding tests there would just re-test the same normalization behavior at a lower-value seam.

## Out of Scope

- Any database schema change (unique constraints, collation).
- A migration/backfill script for existing data (handled manually by the user this round).
- Read-side/defense-in-depth normalization in the report grouping or other consumers.
- Any change to how symbols are displayed (they will simply already be uppercase in storage).
- Normalizing anything other than letter case (e.g. no change to whitespace handling, which the existing trim already covers).

## Further Notes

This is a single-seam fix by design: because every symbol-bearing write in the app passes through exactly one of two validator functions, fixing normalization there makes every existing case-sensitive-looking comparison elsewhere in the codebase correct without touching it. Worth calling out to whoever implements this so they don't feel compelled to also "fix" the report grouping or the name cache — those are already correct once the input is normalized.
