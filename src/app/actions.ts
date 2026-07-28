"use server";

import { revalidatePath } from "next/cache";
import { parseTransactionsCsv, type CsvParseError } from "@/lib/csv";
import { fetchHistoricalFxRate, type Currency } from "@/lib/fx";
import type { Market, Side } from "@/lib/pnl";
import { prisma } from "@/lib/prisma";

function currencyForMarket(market: Market): Currency {
  return market === "TW" ? "TWD" : "USD";
}

export interface ActionResult {
  error?: string;
}

export async function addTransaction(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const tradeDate = String(formData.get("tradeDate") ?? "");
  const market = String(formData.get("market") ?? "") as Market;
  const symbol = String(formData.get("symbol") ?? "").trim();
  const side = String(formData.get("side") ?? "") as Side;
  const quantity = Number(formData.get("quantity"));
  const price = Number(formData.get("price"));

  if (!/^\d{4}-\d{2}-\d{2}$/.test(tradeDate)) {
    return { error: "Trade date must be in YYYY-MM-DD format." };
  }
  if (market !== "TW" && market !== "US") {
    return { error: "Market must be TW or US." };
  }
  if (!symbol) {
    return { error: "Symbol is required." };
  }
  if (side !== "BUY" && side !== "SELL") {
    return { error: "Side must be BUY or SELL." };
  }
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { error: "Quantity must be a positive number." };
  }
  if (!Number.isFinite(price) || price <= 0) {
    return { error: "Price must be a positive number." };
  }

  let fxRate: number;
  try {
    fxRate = await fetchHistoricalFxRate(tradeDate, currencyForMarket(market));
  } catch (err) {
    return {
      error: `Could not resolve the exchange rate for this trade date: ${(err as Error).message}`,
    };
  }

  await prisma.transaction.create({
    data: {
      tradeDate: new Date(tradeDate),
      market,
      symbol,
      side,
      quantity,
      price,
      fxRate,
    },
  });

  revalidatePath("/");

  return {};
}

export interface ImportResult {
  createdCount: number;
  errors: CsvParseError[];
}

export async function importTransactionsCsv(
  _prevState: ImportResult | null,
  formData: FormData,
): Promise<ImportResult> {
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return { createdCount: 0, errors: [{ row: 0, message: "No file provided." }] };
  }

  const text = await file.text();
  const { transactions, errors } = parseTransactionsCsv(text);
  const importErrors: CsvParseError[] = [...errors];

  let createdCount = 0;
  for (const t of transactions) {
    try {
      const fxRate = await fetchHistoricalFxRate(
        t.tradeDate,
        currencyForMarket(t.market),
      );
      await prisma.transaction.create({
        data: {
          tradeDate: new Date(t.tradeDate),
          market: t.market,
          symbol: t.symbol,
          side: t.side,
          quantity: t.quantity,
          price: t.price,
          fxRate,
        },
      });
      createdCount++;
    } catch (err) {
      importErrors.push({
        row: 0,
        message: `Failed to import ${t.symbol} on ${t.tradeDate}: ${(err as Error).message}`,
      });
    }
  }

  revalidatePath("/");

  return { createdCount, errors: importErrors };
}
