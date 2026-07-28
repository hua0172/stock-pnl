"use server";

import { revalidatePath } from "next/cache";
import { parseTransactionsCsv, TRADE_DATE_PATTERN, type CsvParseError } from "@/lib/csv";
import { fetchHistoricalFxRate } from "@/lib/fx";
import { MARKET_CURRENCY } from "@/lib/market";
import type { Market, Side, TransactionInput } from "@/lib/pnl";
import { prisma } from "@/lib/prisma";

async function createTransaction(input: TransactionInput) {
  const fxRate = await fetchHistoricalFxRate(
    input.tradeDate,
    MARKET_CURRENCY[input.market],
  );

  return prisma.transaction.create({
    data: {
      tradeDate: new Date(input.tradeDate),
      market: input.market,
      symbol: input.symbol,
      side: input.side,
      quantity: input.quantity,
      price: input.price,
      fxRate,
    },
  });
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

  if (!TRADE_DATE_PATTERN.test(tradeDate)) {
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

  try {
    await createTransaction({ tradeDate, market, symbol, side, quantity, price });
  } catch (err) {
    return {
      error: `Could not resolve the exchange rate for this trade date: ${(err as Error).message}`,
    };
  }

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
      await createTransaction(t);
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
