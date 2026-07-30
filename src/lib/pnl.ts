export type Market = "TW" | "US";
export type Side = "BUY" | "SELL";

export interface TransactionInput {
  tradeDate: string;
  market: Market;
  symbol: string;
  side: Side;
  quantity: number;
  price: number;
}

export interface PnlTransaction extends TransactionInput {
  fxRate: number;
}

export interface DividendInput {
  paymentDate: string;
  market: Market;
  symbol: string;
  amount: number;
}

// calculatePnl only needs enough to aggregate by symbol — no paymentDate,
// since (unlike weighted-average cost) dividend totals don't depend on order.
export interface PnlDividend {
  symbol: string;
  market: Market;
  amount: number;
  fxRate: number;
}

export interface StockPnl {
  symbol: string;
  market: Market;
  quantityHeld: number;
  avgCostTwd: number;
  currentPriceOriginal: number | null;
  currentFxRate: number | null;
  realizedPnlTwd: number;
  unrealizedPnlTwd: number;
  totalPnlTwd: number;
  // Pure original-currency figures (no FX conversion at all) — a secondary
  // reference alongside the TWD numbers above, e.g. for US-market rows.
  avgCostOriginal: number;
  realizedPnlOriginal: number;
  unrealizedPnlOriginal: number;
  // Derived reporting figures — null whenever the holding is closed
  // (quantityHeld is 0) or live market data is unavailable.
  marketValueTwd: number | null;
  returnRatePercent: number | null;
  allocationPercent: number | null;
  // Total dividend income received for this symbol, in TWD. Always a
  // number (0 when there's none) — unlike the fields above, it doesn't
  // depend on live market data, and a closed holding keeps its historical
  // total.
  dividendTwd: number;
  // Cost basis of the quantity currently held (avgCost × quantityHeld), in
  // TWD and in the holding's original currency. Like dividendTwd, always a
  // number — 0 for a closed holding, since there's no remaining cost basis.
  totalCostTwd: number;
  totalCostOriginal: number;
}

export interface PnlOverview {
  realizedPnlTwd: number;
  unrealizedPnlTwd: number;
  dividendTwd: number;
  totalPnlTwd: number;
}

export interface PnlReport {
  overview: PnlOverview;
  byStock: StockPnl[];
}

// Shared by calculatePnl and findOversellViolation — both need "this
// symbol's transactions, in the order they were passed in" before sorting
// each group chronologically.
function groupBySymbol<T extends { symbol: string }>(transactions: T[]): Map<string, T[]> {
  const bySymbol = new Map<string, T[]>();
  for (const t of transactions) {
    const list = bySymbol.get(t.symbol) ?? [];
    list.push(t);
    bySymbol.set(t.symbol, list);
  }
  return bySymbol;
}

// Shared by calculatePnl and findOversellViolation so the two never disagree
// about what order same-day transactions happened in. Same-day BUYs sort
// before same-day SELLs — there's no recorded time-of-day, and this is the
// only ordering assumption that doesn't misflag a same-day buy-then-sell.
export function compareTransactionsChronologically(
  a: { tradeDate: string; side: Side },
  b: { tradeDate: string; side: Side },
): number {
  const dateComparison = a.tradeDate.localeCompare(b.tradeDate);
  if (dateComparison !== 0) return dateComparison;
  if (a.side === b.side) return 0;
  return a.side === "BUY" ? -1 : 1;
}

export interface OversellViolation {
  symbol: string;
  tradeDate: string;
  availableQuantity: number;
  attemptedQuantity: number;
}

// Replays a SELL-quantity check across a symbol's full chronological history
// (not just today's total holding), so a backdated SELL that would have been
// invalid at the time it's dated is still caught. Returns the first violation
// found (by symbol insertion order, not necessarily the globally earliest
// one across symbols), or null if the whole input is valid throughout.
export function findOversellViolation(
  transactions: TransactionInput[],
): OversellViolation | null {
  const bySymbol = groupBySymbol(transactions);

  for (const [symbol, txs] of bySymbol) {
    const sorted = [...txs].sort(compareTransactionsChronologically);
    let quantityHeld = 0;

    for (const t of sorted) {
      if (t.side === "BUY") {
        quantityHeld += t.quantity;
      } else if (t.quantity > quantityHeld) {
        return {
          symbol,
          tradeDate: t.tradeDate,
          availableQuantity: quantityHeld,
          attemptedQuantity: t.quantity,
        };
      } else {
        quantityHeld -= t.quantity;
      }
    }
  }

  return null;
}

export function calculatePnl(
  transactions: PnlTransaction[],
  dividends: PnlDividend[],
  currentPrices: Partial<Record<string, number>>,
  currentFxRates: Partial<Record<Market, number>>,
): PnlReport {
  const bySymbol = groupBySymbol(transactions);

  const dividendTwdBySymbol = new Map<string, number>();
  const dividendMarketBySymbol = new Map<string, Market>();
  for (const d of dividends) {
    dividendTwdBySymbol.set(
      d.symbol,
      (dividendTwdBySymbol.get(d.symbol) ?? 0) + d.amount * d.fxRate,
    );
    dividendMarketBySymbol.set(d.symbol, d.market);
  }

  const byStock: StockPnl[] = [];
  for (const [symbol, txs] of bySymbol) {
    const sorted = [...txs].sort(compareTransactionsChronologically);
    const market = sorted[0].market;

    let quantityHeld = 0;
    // Running cost-of-currently-held-shares as the loop consumes BUY/SELL
    // transactions — not the same thing as the StockPnl.totalCostTwd field
    // below, which is re-derived from avgCostTwd so it inherits that field's
    // clean-zero guarantee on a closed position (this accumulator alone can
    // leave tiny floating-point residue instead of landing exactly on 0,
    // e.g. after a SELL divides then re-multiplies a fractional share count).
    let costOfHeldTwd = 0;
    let costOfHeldOriginal = 0;
    let realizedPnlTwd = 0;
    let realizedPnlOriginal = 0;

    for (const t of sorted) {
      if (t.side === "BUY") {
        quantityHeld += t.quantity;
        costOfHeldTwd += t.quantity * t.price * t.fxRate;
        costOfHeldOriginal += t.quantity * t.price;
      } else {
        const avgCostPerShareTwd =
          quantityHeld > 0 ? costOfHeldTwd / quantityHeld : 0;
        const avgCostPerShareOriginal =
          quantityHeld > 0 ? costOfHeldOriginal / quantityHeld : 0;
        const costOfSoldTwd = avgCostPerShareTwd * t.quantity;
        const costOfSoldOriginal = avgCostPerShareOriginal * t.quantity;

        realizedPnlTwd += t.quantity * t.price * t.fxRate - costOfSoldTwd;
        realizedPnlOriginal += t.quantity * t.price - costOfSoldOriginal;
        costOfHeldTwd -= costOfSoldTwd;
        costOfHeldOriginal -= costOfSoldOriginal;
        quantityHeld -= t.quantity;
      }
    }

    const avgCostTwd = quantityHeld > 0 ? costOfHeldTwd / quantityHeld : 0;
    const avgCostOriginal =
      quantityHeld > 0 ? costOfHeldOriginal / quantityHeld : 0;
    const currentPriceOriginal = currentPrices[symbol] ?? null;
    const currentFxRate = currentFxRates[market] ?? null;

    const unrealizedPnlTwd =
      quantityHeld > 0 &&
      currentPriceOriginal !== null &&
      currentFxRate !== null
        ? (currentPriceOriginal * currentFxRate - avgCostTwd) * quantityHeld
        : 0;

    const unrealizedPnlOriginal =
      quantityHeld > 0 && currentPriceOriginal !== null
        ? (currentPriceOriginal - avgCostOriginal) * quantityHeld
        : 0;

    const dividendTwd = dividendTwdBySymbol.get(symbol) ?? 0;
    const totalPnlTwd = realizedPnlTwd + unrealizedPnlTwd + dividendTwd;

    // An open position (quantityHeld > 0) needs a current price and FX rate to
    // have a *complete* P&L — without them, totalPnlTwd silently falls back
    // to realized-only (unrealizedPnlTwd defaults to 0 above), which is
    // incomplete data, not a real answer. marketValueTwd and returnRatePercent
    // both depend on that completeness, so both share this condition.
    const hasCompleteMarketData =
      currentPriceOriginal !== null && currentFxRate !== null;

    const marketValueTwd =
      quantityHeld > 0 && hasCompleteMarketData
        ? currentPriceOriginal * currentFxRate * quantityHeld
        : null;

    // Deliberately realizedPnlTwd + unrealizedPnlTwd, not totalPnlTwd —
    // Return Rate reflects price performance only. Dividend income is
    // already visible via Total P&L and dividendTwd; folding it in here
    // too would double-count it into a percentage meant to answer "how did
    // the stock itself do," not "how much did holding it earn me overall."
    const returnRatePercent =
      quantityHeld > 0 && hasCompleteMarketData
        ? ((realizedPnlTwd + unrealizedPnlTwd) / (avgCostTwd * quantityHeld)) * 100
        : null;

    byStock.push({
      symbol,
      market,
      quantityHeld,
      avgCostTwd,
      currentPriceOriginal,
      currentFxRate,
      realizedPnlTwd,
      unrealizedPnlTwd,
      totalPnlTwd,
      avgCostOriginal,
      realizedPnlOriginal,
      unrealizedPnlOriginal,
      marketValueTwd,
      returnRatePercent,
      allocationPercent: null, // filled in below, once every holding's market value is known
      dividendTwd,
      totalCostTwd: avgCostTwd * quantityHeld,
      totalCostOriginal: avgCostOriginal * quantityHeld,
    });
  }

  // A symbol can have dividend records with no transaction history at all —
  // e.g. every transaction was later deleted while the dividends remained.
  // Report it as a no-cost-basis closed holding so its dividend still counts,
  // rather than silently dropping it from byStock and the overview total.
  for (const [symbol, dividendTwd] of dividendTwdBySymbol) {
    if (bySymbol.has(symbol)) continue;

    const market = dividendMarketBySymbol.get(symbol)!;
    const currentPriceOriginal = currentPrices[symbol] ?? null;
    const currentFxRate = currentFxRates[market] ?? null;

    byStock.push({
      symbol,
      market,
      quantityHeld: 0,
      avgCostTwd: 0,
      currentPriceOriginal,
      currentFxRate,
      realizedPnlTwd: 0,
      unrealizedPnlTwd: 0,
      totalPnlTwd: dividendTwd,
      avgCostOriginal: 0,
      realizedPnlOriginal: 0,
      unrealizedPnlOriginal: 0,
      marketValueTwd: null,
      returnRatePercent: null,
      allocationPercent: null,
      dividendTwd,
      totalCostTwd: 0,
      totalCostOriginal: 0,
    });
  }

  const totalMarketValueTwd = byStock.reduce(
    (sum, s) => sum + (s.marketValueTwd ?? 0),
    0,
  );

  for (const s of byStock) {
    s.allocationPercent =
      s.marketValueTwd !== null && totalMarketValueTwd > 0
        ? (s.marketValueTwd / totalMarketValueTwd) * 100
        : null;
  }

  const overview = byStock.reduce(
    (acc, s) => ({
      realizedPnlTwd: acc.realizedPnlTwd + s.realizedPnlTwd,
      unrealizedPnlTwd: acc.unrealizedPnlTwd + s.unrealizedPnlTwd,
      dividendTwd: acc.dividendTwd + s.dividendTwd,
      totalPnlTwd: acc.totalPnlTwd + s.totalPnlTwd,
    }),
    { realizedPnlTwd: 0, unrealizedPnlTwd: 0, dividendTwd: 0, totalPnlTwd: 0 },
  );

  return { overview, byStock };
}
