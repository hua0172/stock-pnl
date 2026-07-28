export type Market = "TW" | "US";
export type Side = "BUY" | "SELL";

export interface PnlTransaction {
  tradeDate: string;
  market: Market;
  symbol: string;
  side: Side;
  quantity: number;
  price: number;
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
    let realizedPnlTwd = 0;

    for (const t of sorted) {
      if (t.side === "BUY") {
        quantityHeld += t.quantity;
        totalCostTwd += t.quantity * t.price * t.fxRate;
      } else {
        const avgCostPerShareTwd =
          quantityHeld > 0 ? totalCostTwd / quantityHeld : 0;
        const proceedsTwd = t.quantity * t.price * t.fxRate;
        const costOfSoldTwd = avgCostPerShareTwd * t.quantity;

        realizedPnlTwd += proceedsTwd - costOfSoldTwd;
        totalCostTwd -= costOfSoldTwd;
        quantityHeld -= t.quantity;
      }
    }

    const avgCostTwd = quantityHeld > 0 ? totalCostTwd / quantityHeld : 0;
    const currentPriceOriginal = currentPrices[symbol] ?? null;
    const currentFxRate = currentFxRates[market] ?? null;

    const unrealizedPnlTwd =
      quantityHeld > 0 &&
      currentPriceOriginal !== null &&
      currentFxRate !== null
        ? (currentPriceOriginal * currentFxRate - avgCostTwd) * quantityHeld
        : 0;

    byStock.push({
      symbol,
      market,
      quantityHeld,
      avgCostTwd,
      currentPriceOriginal,
      currentFxRate,
      realizedPnlTwd,
      unrealizedPnlTwd,
      totalPnlTwd: realizedPnlTwd + unrealizedPnlTwd,
    });
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
