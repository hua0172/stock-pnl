# 01 — Symbol name lookup infrastructure

**What to build:** A new module providing everything later tickets need to display a symbol's name: bulk TW name lookup (TWSE listed + TPEx OTC fallback), per-symbol US name lookup (via Yahoo's existing chart response), a combined multi-symbol lookup helper, and the pure `名稱（代號）` formatting function. No page or form wiring yet — this ticket only adds the foundation and its tests.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] `fetchTwSymbolNames()` fetches TWSE `STOCK_DAY_ALL` and TPEx `tpex_mainboard_quotes`, merging into one `Code → Chinese name` map (TWSE first, TPEx for symbols not found there)
- [ ] `fetchUsSymbolName(symbol)` reads `shortName` from the existing Yahoo chart response; returns `null` if unavailable
- [ ] `fetchSymbolNames(pairs)` combines both: one bulk TW fetch (only if any TW pairs are present) plus parallel per-symbol US fetches, returning a `Partial<Record<string, string>>` with missing entries simply absent
- [ ] `formatSymbolLabel(symbol, name)` returns `名稱（代號）` when a name is given, or the bare symbol when `name` is `undefined`
- [ ] `YahooChartResult`'s `meta` type gains `shortName?: string`
- [ ] `formatSymbolLabel` has a dedicated, passing test file covering both cases
- [ ] No dedicated tests for the network-calling functions (matches existing `price.ts`/`fx.ts` convention) — full test suite and typecheck stay green
