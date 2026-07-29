Status: ready-for-agent

# Dividend Tracking

## Problem Statement

Some of the user's stocks pay dividends, and the current P&L report has no way to record or see this income — dividends received are invisible, and the reported Total P&L understates the actual return from holding these stocks.

## Solution

Add a new, independent Dividend record (market, symbol, payment date, after-tax amount received) tracked separately from Transaction records, following the same manual-entry / edit / delete / audit-log pattern already built for transactions — but with its own dedicated history page rather than merging into the existing transaction history. Extend `calculatePnl` to fold each stock's total dividend income (converted to TWD at the dividend's own payment-date FX rate) into a new per-stock Dividend Income figure, which becomes a third addend in Total P&L (alongside Realized and Unrealized P&L) and therefore automatically flows into Return Rate, since Return Rate is computed from Total P&L. The report page gains a fourth overview card ("股息收入") and a new per-stock table column.

## User Stories

1. As the user, I want to record a dividend I received (market, symbol, payment date, amount), so that this income isn't invisible in my P&L report.
2. As the user, I want the amount I record to be the after-tax amount actually deposited into my account, so that I don't have to separately calculate or track withholding tax.
3. As the user, I want the dividend amount converted to TWD using the historical exchange rate on the payment date (same as transactions), so that a US-stock dividend is comparable and combinable with TWD figures.
4. As the user, I want each stock's total dividend income shown as its own column in the per-stock table, so that I can see exactly how much a given stock has paid me in dividends, distinct from its trading gains/losses.
5. As the user, I want a fourth overview card ("股息收入") on the report page alongside Realized P&L, Unrealized P&L, and Total P&L, so that dividend income is visible at a glance without digging into the per-stock table.
6. As the user, I want Total P&L to equal Realized P&L + Unrealized P&L + Dividend Income, so that my headline number reflects the full picture of what a holding has earned me.
7. As the user, I want Realized P&L and Unrealized P&L to remain exactly as they are today (trading-only), so that those two figures keep their existing, precise meaning and aren't diluted by folding dividends into them directly.
8. As the user, I want Return Rate to include dividend income, since it's derived from Total P&L, so that a dividend-paying stock's reported return reflects the income I actually received from holding it, not just its price movement.
9. As the user, I want a closed position's (fully sold) historical dividend income to keep showing in the per-stock table, so that dividends I actually received don't disappear just because I later sold the stock — consistent with how Realized P&L already works for closed holdings.
10. As the user, I want to edit a dividend record (in case I mistype the amount or date), so that I can correct a data-entry mistake the same way I already can for transactions.
11. As the user, I want to delete a dividend record, so that I can remove a duplicate or mistaken entry.
12. As the user, I want a confirmation prompt before a dividend delete actually happens, so that I don't lose a record to a misclick — consistent with how transaction deletes already work.
13. As the user, I want every dividend create/edit/delete to be recorded in an audit log, so that I have the same traceability for dividends that I already have for transactions.
14. As the user, I want the dividend audit log to be its own separate page (not merged with the transaction history page), so that I can review dividend-specific history on its own timeline.
15. As the user, I want the dividend audit log to distinguish a correction (edit/delete) from an original entry (create), the same way the transaction audit log already does, so that "I fixed a typo" is never confused with "I received another dividend payment."
16. As the user, I want a dedicated page listing every individual dividend record with edit/delete actions, so that I can find and manage a specific entry, consistent with how the transaction list page already works.
17. As the user, I want the new dividend pages to be in Traditional Chinese, consistent with the rest of the app.
18. As the user, I want the app to keep working correctly (existing transaction functionality, P&L math, and charts unaffected for stocks with no dividends) after this change, so that this feature is additive, not a regression.
19. As the user, when there's no dividend income for a stock, I want its Dividend Income to simply show as zero, rather than requiring any special case, so that the report reads consistently whether or not a stock pays dividends.

## Implementation Decisions

- **New Prisma model `Dividend`**: `id` (cuid), `market` (the existing `Market` enum), `symbol` (String), `paymentDate` (DateTime), `amount` (Float, after-tax, in the market's original currency), `fxRate` (Float, TWD per unit of original currency at payment date — `1.0` for `TW`), `createdAt`.
- **New Prisma model `DividendAuditLog`**: mirrors `TransactionAuditLog`'s shape (`action`: `CREATE`/`UPDATE`/`DELETE`, `dividendId`, `before`/`after` JSON snapshots, `createdAt`) but is its own separate table — append-only, never updated or deleted from application code, exactly like `TransactionAuditLog`.
- **`calculatePnl` extended** (`src/lib/pnl.ts`): gains a new `dividends` parameter (a list of `{ symbol, market, amount, fxRate }` per record). For each symbol, sums `amount × fxRate` across all its dividend records into a new `dividendTwd` field on `StockPnl` (always a number, never `null` — `0` when there are no dividends for that symbol, since it doesn't depend on live/current market data the way `marketValueTwd`/`returnRatePercent`/`allocationPercent` do). `totalPnlTwd` becomes `realizedPnlTwd + unrealizedPnlTwd + dividendTwd`; `returnRatePercent`'s formula is unchanged (`totalPnlTwd / (avgCostTwd × quantityHeld) × 100`) but now reflects dividends automatically since it reads the extended `totalPnlTwd`. `overview` gains a `dividendTwd` sum across all stocks, and `overview.totalPnlTwd` extends the same way.
- **`src/lib/dividend-input.ts`** (new, mirroring `src/lib/transaction-input.ts`): `validateDividendInput(raw) -> { value } | { error }` — validates `paymentDate` (same `YYYY-MM-DD` pattern as trade date), `market` ∈ {TW,US}, and a positive `amount`.
- **`src/lib/dividend-audit-log.ts`** (new, mirroring `src/lib/audit-log.ts`): `describeDividendAuditEntry(entry) -> { actionLabel, summary }` — pure function producing the same three action labels (新增/編輯/刪除) with a summary appropriate to a dividend's fields (market, symbol, payment date, amount) rather than a transaction's.
- **Server Actions**: `addDividend`, `updateDividend`, `deleteDividend`. Each resolves the historical FX rate for the payment date (reusing `fetchHistoricalFxRate`, same as transactions), writes the `Dividend` row and its corresponding `DividendAuditLog` entry inside a single `prisma.$transaction`, and revalidates the report, dividend list, and dividend history pages.
- **New pages**: `/dividends` (list, with 編輯/刪除 per row, mirroring `/transactions`), `/dividends/new` (manual entry form, mirroring `/transactions/new`), `/dividends/[id]/edit` (mirroring the transaction edit page), `/dividends/history` (separate audit log page, mirroring `/transactions/history` but reading `DividendAuditLog` via `describeDividendAuditEntry`).
- **Report page**: gains a fourth overview card ("股息收入") and a new "股息" column in the per-stock table; nav links to the new dividend pages, alongside the existing transaction ones.
- **No CSV import for dividends** — manual entry only, per this round's decision (may be revisited later, same as transactions once were before CSV import was added to them).
- **Domain glossary**: `CONTEXT.md` gains a **Dividend** (股息) term. **Total P&L**'s definition is made explicit and extended to include Dividend Income. **Return Rate**'s existing definition already reads "Total P&L ÷ ...", so no wording change is needed there beyond noting it now includes dividends transitively.

## Testing Decisions

- **`calculatePnl`** (existing seam, `src/lib/pnl.test.ts` extended): new test cases —
  - a stock with one dividend record: `dividendTwd` reflects `amount × fxRate`, and `totalPnlTwd`/`returnRatePercent` include it
  - a stock with multiple dividend records: `dividendTwd` sums all of them
  - a stock with no dividend records: `dividendTwd` is `0`, not `null`, and behavior is unchanged from before this feature
  - a closed holding (`quantityHeld` = 0) with historical dividend income: `dividendTwd` still reflects the total (unlike `returnRatePercent`, which stays `null` for closed holdings per existing behavior)
  - `overview.dividendTwd` and `overview.totalPnlTwd` correctly sum across multiple stocks
- **`validateDividendInput`** (new seam, mirrors `validateTransactionInput`'s test suite): valid input; each invalid case (bad date, bad market, non-positive amount).
- **`describeDividendAuditEntry`** (new seam, mirrors `describeAuditEntry`'s test suite): a CREATE entry summarizes the new dividend; an UPDATE entry with a changed field names it; a DELETE entry summarizes the deleted dividend.
- No dedicated tests for the Server Actions or the four new pages — verified manually in the browser (add, edit, delete with confirmation, audit log entries), consistent with how the transaction equivalents were verified.

## Out of Scope

- CSV import for dividends — manual entry only this round.
- Any change to how Realized P&L or Unrealized P&L are individually defined or calculated — dividends are additive as a third figure, not folded into either.
- Any tax/withholding calculation — the amount recorded is exactly what the user says they received, after tax, with no gross-up or withholding-rate logic.
- Deriving a dividend's total from a per-share amount and historical share count — the user always enters the total amount received directly.
- Merging the dividend audit log with the transaction audit log, or their history pages — explicitly kept separate per this round's decision.
- Any chart for dividends (e.g. a dividend-income-over-time chart) — only the overview card and per-stock table column, per this round's decision.

## Further Notes

- This closely mirrors the transaction edit/delete/audit-log feature shipped previously — `dividend-input.ts`, `dividend-audit-log.ts`, and the dividend Server Actions/pages are each a parallel, independent implementation rather than a shared abstraction with the transaction versions, since the two entities' field sets differ enough (no side/quantity/price for dividends) that forcing a shared interface would cost more than it saves.
- If dividends and transactions later turn out to want the same history page after all, that's a straightforward follow-up (add an entity-type discriminator and merge the two audit tables) — not attempted now since it wasn't asked for.
