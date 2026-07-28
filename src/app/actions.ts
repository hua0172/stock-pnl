"use server";

import { revalidatePath } from "next/cache";
import { parseTransactionsCsv, type CsvParseError } from "@/lib/csv";
import { fetchHistoricalFxRate } from "@/lib/fx";
import { MARKET_CURRENCY } from "@/lib/market";
import type { TransactionInput } from "@/lib/pnl";
import { prisma } from "@/lib/prisma";
import { validateTransactionInput } from "@/lib/transaction-input";

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
  const validated = validateTransactionInput({
    tradeDate: String(formData.get("tradeDate") ?? ""),
    market: String(formData.get("market") ?? ""),
    symbol: String(formData.get("symbol") ?? ""),
    side: String(formData.get("side") ?? ""),
    quantity: String(formData.get("quantity") ?? ""),
    price: String(formData.get("price") ?? ""),
  });

  if (!validated.value) {
    return { error: validated.error };
  }

  try {
    await createTransaction(validated.value);
  } catch (err) {
    return {
      error: `無法取得此交易日期的匯率：${(err as Error).message}`,
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
    return { createdCount: 0, errors: [{ row: 0, message: "請選擇一個檔案。" }] };
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
        message: `匯入失敗（${t.symbol}，${t.tradeDate}）：${(err as Error).message}`,
      });
    }
  }

  revalidatePath("/");

  return { createdCount, errors: importErrors };
}
