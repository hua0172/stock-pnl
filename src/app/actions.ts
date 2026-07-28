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
    return { error: "交易日期格式必須是 YYYY-MM-DD。" };
  }
  if (market !== "TW" && market !== "US") {
    return { error: "市場欄位必須是 TW 或 US。" };
  }
  if (!symbol) {
    return { error: "請輸入股票代號。" };
  }
  if (side !== "BUY" && side !== "SELL") {
    return { error: "買賣別必須是 BUY 或 SELL。" };
  }
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { error: "股數必須是正數。" };
  }
  if (!Number.isFinite(price) || price <= 0) {
    return { error: "價格必須是正數。" };
  }

  try {
    await createTransaction({ tradeDate, market, symbol, side, quantity, price });
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
