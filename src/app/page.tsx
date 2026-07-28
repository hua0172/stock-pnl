import Link from "next/link";
import { fetchCurrentFxRate } from "@/lib/fx";
import { MARKET_CURRENCY, MARKET_PRICE_PREFIX } from "@/lib/market";
import { calculatePnl, type Market, type PnlTransaction, type Side, type StockPnl } from "@/lib/pnl";
import { fetchCurrentPrice } from "@/lib/price";
import { prisma } from "@/lib/prisma";
import { ReportCharts } from "./report-charts";

// This page always reflects the latest transactions and live market data —
// it must never be served from Next.js's static/ISR cache.
export const dynamic = "force-dynamic";

function formatTwd(amount: number): string {
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function pnlColor(amount: number): string {
  if (amount > 0) return "text-red-600 dark:text-red-400";
  if (amount < 0) return "text-green-600 dark:text-green-400";
  return "text-zinc-500";
}

function formatOriginal(market: Market, amount: number): string {
  return `${MARKET_PRICE_PREFIX[market]}${amount.toFixed(2)}`;
}

// US-market rows carry a USD reference alongside every TWD figure; TW rows
// are already denominated in TWD, so there's nothing to show alongside.
function originalRef(stock: StockPnl, amount: number): string | null {
  return stock.market === "US" ? `(${formatOriginal(stock.market, amount)})` : null;
}

export default async function ReportPage() {
  const rows = await prisma.transaction.findMany({
    orderBy: { tradeDate: "asc" },
  });

  const transactions: PnlTransaction[] = rows.map((r) => ({
    tradeDate: r.tradeDate.toISOString().slice(0, 10),
    market: r.market as Market,
    symbol: r.symbol,
    side: r.side as Side,
    quantity: r.quantity,
    price: r.price,
    fxRate: r.fxRate,
  }));

  const uniqueStocks = [
    ...new Map(transactions.map((t) => [t.symbol, t])).values(),
  ];

  const priceResults = await Promise.allSettled(
    uniqueStocks.map(async (t) => ({
      symbol: t.symbol,
      price: await fetchCurrentPrice(t.market, t.symbol),
    })),
  );

  const currentPrices: Partial<Record<string, number>> = {};
  const dataErrors: string[] = [];

  for (const result of priceResults) {
    if (result.status === "fulfilled") {
      currentPrices[result.value.symbol] = result.value.price;
    } else {
      dataErrors.push(String(result.reason));
    }
  }

  const marketsInUse = [...new Set(uniqueStocks.map((t) => t.market))];
  const currentFxRates: Partial<Record<Market, number>> = {};

  for (const market of marketsInUse) {
    try {
      currentFxRates[market] = await fetchCurrentFxRate(MARKET_CURRENCY[market]);
    } catch (err) {
      dataErrors.push(String((err as Error).message));
    }
  }

  const report = calculatePnl(transactions, currentPrices, currentFxRates);

  return (
    <div className="flex flex-1 flex-col gap-8 bg-zinc-50 p-8 font-sans dark:bg-black">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
          Stock P&amp;L
        </h1>
        <div className="flex gap-3">
          <Link
            href="/transactions/new"
            className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background"
          >
            Add transaction
          </Link>
          <Link
            href="/transactions/import"
            className="rounded-full border border-black/[.08] px-4 py-2 text-sm font-medium dark:border-white/[.145]"
          >
            Import CSV
          </Link>
        </div>
      </header>

      {dataErrors.length > 0 && (
        <div className="rounded-lg border border-amber-400 bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <p className="font-medium">
            Some live data could not be fetched — the numbers below may be incomplete:
          </p>
          <ul className="mt-2 list-disc pl-5">
            {dataErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-black/[.08] bg-white p-4 dark:border-white/[.145] dark:bg-zinc-900">
          <p className="text-sm text-zinc-500">Realized P&amp;L</p>
          <p className={`text-xl font-semibold ${pnlColor(report.overview.realizedPnlTwd)}`}>
            {formatTwd(report.overview.realizedPnlTwd)}
          </p>
        </div>
        <div className="rounded-lg border border-black/[.08] bg-white p-4 dark:border-white/[.145] dark:bg-zinc-900">
          <p className="text-sm text-zinc-500">Unrealized P&amp;L</p>
          <p className={`text-xl font-semibold ${pnlColor(report.overview.unrealizedPnlTwd)}`}>
            {formatTwd(report.overview.unrealizedPnlTwd)}
          </p>
        </div>
        <div className="rounded-lg border border-black/[.08] bg-white p-4 dark:border-white/[.145] dark:bg-zinc-900">
          <p className="text-sm text-zinc-500">Total P&amp;L</p>
          <p className={`text-xl font-semibold ${pnlColor(report.overview.totalPnlTwd)}`}>
            {formatTwd(report.overview.totalPnlTwd)}
          </p>
        </div>
      </section>

      <section className="overflow-x-auto rounded-lg border border-black/[.08] bg-white dark:border-white/[.145] dark:bg-zinc-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-black/[.08] text-zinc-500 dark:border-white/[.145]">
            <tr>
              <th className="p-3">Symbol</th>
              <th className="p-3">Market</th>
              <th className="p-3">Qty held</th>
              <th className="p-3">Avg cost (TWD)</th>
              <th className="p-3">Current price</th>
              <th className="p-3">Realized</th>
              <th className="p-3">Unrealized</th>
              <th className="p-3">Total</th>
            </tr>
          </thead>
          <tbody>
            {report.byStock.map((s) => (
              <tr
                key={s.symbol}
                className="border-b border-black/[.04] last:border-0 dark:border-white/[.08]"
              >
                <td className="p-3 font-medium">{s.symbol}</td>
                <td className="p-3">{s.market}</td>
                <td className="p-3">{s.quantityHeld}</td>
                <td className="p-3">
                  {formatTwd(s.avgCostTwd)}
                  {originalRef(s, s.avgCostOriginal) && (
                    <span className="ml-1 text-zinc-500">
                      {originalRef(s, s.avgCostOriginal)}
                    </span>
                  )}
                </td>
                <td className="p-3">
                  {s.currentPriceOriginal !== null
                    ? formatOriginal(s.market, s.currentPriceOriginal)
                    : "—"}
                </td>
                <td className={`p-3 ${pnlColor(s.realizedPnlTwd)}`}>
                  {formatTwd(s.realizedPnlTwd)}
                  {originalRef(s, s.realizedPnlOriginal) && (
                    <span className="ml-1 text-zinc-500">
                      {originalRef(s, s.realizedPnlOriginal)}
                    </span>
                  )}
                </td>
                <td className={`p-3 ${pnlColor(s.unrealizedPnlTwd)}`}>
                  {formatTwd(s.unrealizedPnlTwd)}
                  {originalRef(s, s.unrealizedPnlOriginal) && (
                    <span className="ml-1 text-zinc-500">
                      {originalRef(s, s.unrealizedPnlOriginal)}
                    </span>
                  )}
                </td>
                <td className={`p-3 font-medium ${pnlColor(s.totalPnlTwd)}`}>
                  {formatTwd(s.totalPnlTwd)}
                  {originalRef(s, s.realizedPnlOriginal + s.unrealizedPnlOriginal) && (
                    <span className="ml-1 font-normal text-zinc-500">
                      {originalRef(s, s.realizedPnlOriginal + s.unrealizedPnlOriginal)}
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {report.byStock.length === 0 && (
              <tr>
                <td className="p-6 text-center text-zinc-500" colSpan={8}>
                  No transactions yet.{" "}
                  <Link href="/transactions/new" className="underline">
                    Add one
                  </Link>
                  .
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <ReportCharts byStock={report.byStock} />
    </div>
  );
}
