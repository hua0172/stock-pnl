"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import type { Transaction } from "@/generated/prisma/client";
import type { TransactionSnapshot } from "@/lib/audit-log";
import { parseTransactionsCsv, type CsvParseError } from "@/lib/csv";
import { fetchHistoricalFxRate } from "@/lib/fx";
import { MARKET_CURRENCY } from "@/lib/market";
import type { Market, Side, TransactionInput } from "@/lib/pnl";
import { prisma } from "@/lib/prisma";
import {
  validateTransactionInput,
  type RawTransactionInput,
} from "@/lib/transaction-input";

function snapshotFromRecord(record: Transaction): TransactionSnapshot {
  return {
    tradeDate: record.tradeDate.toISOString().slice(0, 10),
    market: record.market as Market,
    symbol: record.symbol,
    side: record.side as Side,
    quantity: record.quantity,
    price: record.price,
    fxRate: record.fxRate,
  };
}

function parseTransactionFormData(formData: FormData): RawTransactionInput {
  return {
    tradeDate: String(formData.get("tradeDate") ?? ""),
    market: String(formData.get("market") ?? ""),
    symbol: String(formData.get("symbol") ?? ""),
    side: String(formData.get("side") ?? ""),
    quantity: String(formData.get("quantity") ?? ""),
    price: String(formData.get("price") ?? ""),
  };
}

function formatFxRateError(err: unknown): string {
  return `無法取得此交易日期的匯率：${(err as Error).message}`;
}

async function findExistingTransaction(
  id: string,
): Promise<{ existing: Transaction; before: TransactionSnapshot } | { error: string }> {
  const existing = await prisma.transaction.findUnique({ where: { id } });
  if (!existing) {
    return { error: "找不到這筆交易，可能已經被刪除。" };
  }

  return { existing, before: snapshotFromRecord(existing) };
}

function revalidateTransactionPages() {
  revalidatePath("/");
  revalidatePath("/transactions");
  revalidatePath("/transactions/history");
}

async function createTransaction(input: TransactionInput) {
  const fxRate = await fetchHistoricalFxRate(
    input.tradeDate,
    MARKET_CURRENCY[input.market],
  );

  const snapshot: TransactionSnapshot = { ...input, fxRate };

  return prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.create({
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

    await tx.transactionAuditLog.create({
      data: {
        action: "CREATE",
        transactionId: transaction.id,
        before: Prisma.DbNull,
        after: snapshot as unknown as Prisma.InputJsonValue,
      },
    });

    return transaction;
  });
}

export interface ActionResult {
  error?: string;
}

export async function addTransaction(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const validated = validateTransactionInput(parseTransactionFormData(formData));

  if (!validated.value) {
    return { error: validated.error };
  }

  try {
    await createTransaction(validated.value);
  } catch (err) {
    return { error: formatFxRateError(err) };
  }

  revalidateTransactionPages();

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

  revalidateTransactionPages();

  return { createdCount, errors: importErrors };
}

export async function updateTransaction(
  id: string,
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const validated = validateTransactionInput(parseTransactionFormData(formData));

  if (!validated.value) {
    return { error: validated.error };
  }

  const found = await findExistingTransaction(id);
  if ("error" in found) {
    return { error: found.error };
  }

  const { before } = found;
  const dateOrMarketChanged =
    before.tradeDate !== validated.value.tradeDate || before.market !== validated.value.market;

  let fxRate = before.fxRate;
  if (dateOrMarketChanged) {
    try {
      fxRate = await fetchHistoricalFxRate(
        validated.value.tradeDate,
        MARKET_CURRENCY[validated.value.market],
      );
    } catch (err) {
      return { error: formatFxRateError(err) };
    }
  }

  const after: TransactionSnapshot = { ...validated.value, fxRate };

  await prisma.$transaction(async (tx) => {
    await tx.transaction.update({
      where: { id },
      data: {
        tradeDate: new Date(after.tradeDate),
        market: after.market,
        symbol: after.symbol,
        side: after.side,
        quantity: after.quantity,
        price: after.price,
        fxRate: after.fxRate,
      },
    });

    await tx.transactionAuditLog.create({
      data: {
        action: "UPDATE",
        transactionId: id,
        before: before as unknown as Prisma.InputJsonValue,
        after: after as unknown as Prisma.InputJsonValue,
      },
    });
  });

  revalidateTransactionPages();

  return {};
}

export async function deleteTransaction(id: string): Promise<ActionResult> {
  const found = await findExistingTransaction(id);
  if ("error" in found) {
    return { error: found.error };
  }

  const { before } = found;

  await prisma.$transaction(async (tx) => {
    await tx.transaction.delete({ where: { id } });

    await tx.transactionAuditLog.create({
      data: {
        action: "DELETE",
        transactionId: id,
        before: before as unknown as Prisma.InputJsonValue,
        after: Prisma.DbNull,
      },
    });
  });

  revalidateTransactionPages();

  return {};
}
