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
}

export interface PnlOverview {
  realizedPnlTwd: number;
  unrealizedPnlTwd: number;
  totalPnlTwd: number;
}

export interface PnlReport {
  overview: PnlOverview;
  byStock: StockPnl[];
}

export function calculatePnl(
  transactions: PnlTransaction[],
  currentPrices: Partial<Record<string, number>>,
  currentFxRates: Partial<Record<Market, number>>,
): PnlReport {
  const bySymbol = new Map<string, PnlTransaction[]>();
  for (const t of transactions) {
    const list = bySymbol.get(t.symbol) ?? [];
    list.push(t);
    bySymbol.set(t.symbol, list);
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

    const totalPnlTwd = realizedPnlTwd + unrealizedPnlTwd;

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
      totalPnlTwd: acc.totalPnlTwd + s.totalPnlTwd,
    }),
    { realizedPnlTwd: 0, unrealizedPnlTwd: 0, totalPnlTwd: 0 },
  );

  return { overview, byStock };
}
