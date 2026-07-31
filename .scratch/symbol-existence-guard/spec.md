Status: ready-for-agent

# Symbol Existence Guard

## Problem Statement

Nothing currently stops the user from saving a transaction or dividend for a stock symbol that doesn't actually exist (a typo, or a delisted/never-existed ticker). The symbol just gets stored as-is, and only shows up as a problem later — e.g. as a bare, unresolved code in the report (no name found) or a price the app can never fetch.

## Solution

Before saving a transaction or dividend (add or edit), verify the symbol resolves against real market data, and block the save with a clear error if it's confirmed not to exist. To avoid the risk demonstrated earlier in this project (TWSE's open-data endpoint is intermittently slow/unreachable from this app's server — see the symbol-name-display feature's ticket 01), this is a **cross-checked, fail-open** verification: a symbol is only ever blocked when every data source that was consulted responded successfully and none of them recognized it. If any source couldn't be reached or timed out, the save proceeds — a temporary outage in an external data source must never stop the user from recording a real trade or dividend. TW-market symbols get two independent sources (Taiwan's open exchange data, and a live Yahoo Finance price lookup); US-market symbols only have Yahoo available.

## User Stories

1. As the user, I want saving a transaction or dividend for a symbol that doesn't exist to be blocked with a clear error, so I catch a typo immediately instead of finding a broken row in my report later.
2. As the user, I want this check to consult more than one data source for TW-market symbols (the same Taiwan open exchange data already used for Chinese names, plus an independent live Yahoo Finance price lookup), so a symbol is only rejected when two unrelated sources agree it doesn't exist.
3. As the user, I want a temporary failure or timeout in any one data source to never block a save on its own — only being told "not found" by every source that was actually reachable should block me. An external data source having a bad moment must not stop me from recording a real trade.
4. As the user, I want this applied to adding and editing both transactions and dividends — four save actions in total.
5. As the user, I want an early, non-blocking hint in the form (reusing the existing symbol-name lookup already shown on blur) when no name was found for what I typed, so I have a chance to notice and fix a typo before I even try to save — but the actual block only happens at save time, not just from this hint.
6. As the user, I want a clear error message naming the symbol that couldn't be confirmed, so I know exactly what to check.

## Implementation Decisions

- **New module** (e.g. `src/lib/symbol-existence.ts`): builds on the symbol-name-display feature's existing lookups rather than introducing new data sources.
  - For each data source consulted, model the outcome as two independent facts: whether the source **responded** (successfully returned data, regardless of what it contained) and whether the symbol was **found** in that response. A source that timed out, errored, or couldn't be reached did not respond, and contributes nothing either way.
  - **TW-market check**: two independent sources —
    - The existing bulk Taiwan open-data lookup (TWSE `STOCK_DAY_ALL` + TPEx `tpex_mainboard_quotes`, already fetched together for the name-display feature): responded if the combined lookup returned real data at all (in practice, a non-empty result — these bulk endpoints never legitimately return zero rows when the connection succeeds), found if the symbol is present in it.
    - An independent live Yahoo Finance price lookup (the same `.TW` → `.TWO` fallback the report page already uses for prices): responded if Yahoo returned an actual answer (a real price, or a clean "no such symbol" response) rather than the request itself failing to complete (network/timeout failure); found if a real price came back.
  - **US-market check**: only the Yahoo Finance lookup is available — same responded/found distinction, no second source to cross-check against.
  - **The single pure, tested seam**: a function that takes the responded/found outcome from each source consulted and decides the overall result — `exists` (at least one source confirmed it), `confirmedAbsent` (every source that responded said no, and at least one source did respond), or otherwise "undetermined" (treated the same as existing, for the purpose of not blocking). This is the one piece of this feature with real branching logic worth unit testing in isolation from any network call.
- **Wiring into the four save paths** (`addTransaction`, `updateTransaction` in `src/app/actions.ts`; `addDividend`, `updateDividend` in `src/app/dividend-actions.ts`): after input validation (and, for transactions, after the oversell guard already there), run the existence check for the entered market/symbol. Only `confirmedAbsent` blocks the save, returning an error: `找不到股票代號「{symbol}」，請確認代號是否正確。` A source that failed to respond does not block — the save proceeds as if the symbol were fine.
- **Form hint**: the existing `SymbolMarketFields` component's blur-triggered name lookup (from symbol-name-display) already shows nothing when no name resolves. This round adds a small, clearly non-blocking warning text in that same no-name-found case (e.g. "查無此代號的名稱資料，請確認是否正確") — advisory only, using the existing name-lookup result as-is (it does not need the full cross-source certainty logic, since it never blocks anything).
- **No schema changes** — this is a write-time validation layer, nothing new is persisted.

## Testing Decisions

- **The existence-decision function** (new, dedicated test file): given various combinations of `{responded, found}` per source, confirm: any source finding it → `exists`; every consulted source responding and none finding it → `confirmedAbsent`; any source not responding, with no source finding it either → neither (treated as not blocking) — covering the TW two-source case and the US one-source case.
- **No dedicated tests for the network-calling lookups themselves** (the TWSE/TPEx/Yahoo calls) — consistent with how `fetchTwSymbolNames`/`fetchUsSymbolName`/`fetchCurrentPrice`/`fetchHistoricalFxRate` are already handled in this codebase (verified manually, not unit tested).
- **No dedicated tests for the four Server Actions or the form hint** — verified manually in the browser: a real symbol saves normally; a clearly fake symbol (e.g. a nonsense string) is blocked with the expected error; confirm (as best as can be arranged manually) that the block only fires when it should.

## Out of Scope

- Any change to the symbol-name-display feature's existing cosmetic name lookup itself — this feature only adds the blocking existence check alongside it, and a small warning-text addition to the form hint.
- Retroactively validating symbols already in the database — this guard only applies to new writes (add/edit) going forward.
- CSV import — not in scope for this round (mirrors how the original oversell guard was extended to CSV import as its own ticket; this could be a similar follow-up but isn't requested here).
- Any attempt to definitively resolve the "did this fail because the symbol doesn't exist, or because the network request itself failed" question with 100% certainty for every possible error shape — the responded/found distinction is a best-effort classification, biased deliberately toward "don't block" when uncertain.

## Further Notes

- This is a natural companion to the symbol-name-display feature (reuses its data sources) and the oversell-guard feature (mirrors its "block at save time" pattern and its fail-open posture toward external-data-source unreliability, learned directly from the TWSE flakiness discovered while building that feature).
- This was synthesized from a `/grill-with-docs` session held in this same conversation — see that session for the full reasoning behind the fail-open design, especially why a single-source failure must never block a save.
