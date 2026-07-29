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

export function calculatePnl(
  transactions: PnlTransaction[],
  dividends: PnlDividend[],
  currentPrices: Partial<Record<string, number>>,
  currentFxRates: Partial<Record<Market, number>>,
): PnlReport {
  const bySymbol = new Map<string, PnlTransaction[]>();
  for (const t of transactions) {
    const list = bySymbol.get(t.symbol) ?? [];
    list.push(t);
    bySymbol.set(t.symbol, list);
  }

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
    const sorted = [...txs].sort((a, b) =>
      a.tradeDate.localeCompare(b.tradeDate),
    );
    const market = sorted[0].market;

    let quantityHeld = 0;
    let totalCostTwd = 0;
    let totalCostOriginal = 0;
    let realizedPnlTwd = 0;
    let realizedPnlOriginal = 0;

    for (const t of sorted) {
      if (t.side === "BUY") {
        quantityHeld += t.quantity;
        totalCostTwd += t.quantity * t.price * t.fxRate;
        totalCostOriginal += t.quantity * t.price;
      } else {
        const avgCostPerShareTwd =
          quantityHeld > 0 ? totalCostTwd / quantityHeld : 0;
        const avgCostPerShareOriginal =
          quantityHeld > 0 ? totalCostOriginal / quantityHeld : 0;
        const costOfSoldTwd = avgCostPerShareTwd * t.quantity;
        const costOfSoldOriginal = avgCostPerShareOriginal * t.quantity;

        realizedPnlTwd += t.quantity * t.price * t.fxRate - costOfSoldTwd;
        realizedPnlOriginal += t.quantity * t.price - costOfSoldOriginal;
        totalCostTwd -= costOfSoldTwd;
        totalCostOriginal -= costOfSoldOriginal;
        quantityHeld -= t.quantity;
      }
    }

    const avgCostTwd = quantityHeld > 0 ? totalCostTwd / quantityHeld : 0;
    const avgCostOriginal =
      quantityHeld > 0 ? totalCostOriginal / quantityHeld : 0;
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

    const returnRatePercent =
      quantityHeld > 0 && hasCompleteMarketData
        ? (totalPnlTwd / (avgCostTwd * quantityHeld)) * 100
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
