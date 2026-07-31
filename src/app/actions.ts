"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import type { Transaction } from "@/generated/prisma/client";
import type { TransactionSnapshot } from "@/lib/audit-log";
import { parseTransactionsCsv, type CsvParseError } from "@/lib/csv";
import { fetchHistoricalFxRate } from "@/lib/fx";
import { MARKET_CURRENCY } from "@/lib/market";
import {
  findOversellViolation,
  type Market,
  type OversellViolation,
  type Side,
  type TransactionInput,
} from "@/lib/pnl";
import { prisma } from "@/lib/prisma";
import { verifySymbolExists } from "@/lib/symbol-existence";
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

function formatOversellError(violation: OversellViolation): string {
  return `股數不足：${violation.tradeDate} 當下持有 ${violation.availableQuantity} 股，無法賣出 ${violation.attemptedQuantity} 股`;
}

function formatDeleteOversellError(violation: OversellViolation): string {
  return `無法刪除：刪除後，${violation.tradeDate} 的賣出交易將變成超賣（當下僅剩 ${violation.availableQuantity} 股，但那筆賣出了 ${violation.attemptedQuantity} 股）`;
}

function formatSymbolNotFoundError(symbol: string): string {
  return `找不到股票代號「${symbol}」，請確認代號是否正確。`;
}

async function existingTransactionInputsForSymbol(
  symbol: string,
  excludeId?: string,
): Promise<TransactionInput[]> {
  const rows = await prisma.transaction.findMany({
    where: excludeId ? { symbol, id: { not: excludeId } } : { symbol },
  });

  return rows.map(snapshotFromRecord);
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

  // Oversell check first — it's a fast, local computation. The existence
  // check comes after since it costs a network round-trip; no reason to pay
  // that cost when a cheaper check would already reject the save.
  const existing = await existingTransactionInputsForSymbol(validated.value.symbol);
  const violation = findOversellViolation([...existing, validated.value]);
  if (violation) {
    return { error: formatOversellError(violation) };
  }

  const existence = await verifySymbolExists(validated.value.market, validated.value.symbol);
  if (existence.confirmedAbsent) {
    return { error: formatSymbolNotFoundError(validated.value.symbol) };
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

  // Running per-symbol transaction list, seeded from the DB and updated as
  // each row in this batch is actually inserted — so a later row is checked
  // against both existing data and earlier rows from the same file.
  const runningBySymbol = new Map<string, TransactionInput[]>();
  for (const symbol of new Set(transactions.map((t) => t.symbol))) {
    runningBySymbol.set(symbol, await existingTransactionInputsForSymbol(symbol));
  }

  let createdCount = 0;
  for (const t of transactions) {
    const existingForSymbol = runningBySymbol.get(t.symbol) ?? [];
    const violation = findOversellViolation([...existingForSymbol, t]);
    if (violation) {
      importErrors.push({
        row: 0,
        message: `匯入失敗（${t.symbol}，${t.tradeDate}）：股數不足，當下持有 ${violation.availableQuantity} 股，無法賣出 ${violation.attemptedQuantity} 股`,
      });
      continue;
    }

    try {
      await createTransaction(t);
      createdCount++;
      runningBySymbol.set(t.symbol, [...existingForSymbol, t]);
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

  // Oversell checks first (fast, local) — the existence check comes after
  // since it costs a network round-trip.
  const existingForNewSymbol = await existingTransactionInputsForSymbol(
    validated.value.symbol,
    id,
  );
  const violation = findOversellViolation([...existingForNewSymbol, validated.value]);
  if (violation) {
    return { error: formatOversellError(violation) };
  }

  // Changing which symbol this transaction belongs to is, from the
  // original symbol's perspective, equivalent to deleting it — its
  // remaining transactions must still be a valid sequence on their own.
  if (before.symbol !== validated.value.symbol) {
    const remainingForOldSymbol = await existingTransactionInputsForSymbol(
      before.symbol,
      id,
    );
    const oldSymbolViolation = findOversellViolation(remainingForOldSymbol);
    if (oldSymbolViolation) {
      return { error: formatOversellError(oldSymbolViolation) };
    }
  }

  const existence = await verifySymbolExists(validated.value.market, validated.value.symbol);
  if (existence.confirmedAbsent) {
    return { error: formatSymbolNotFoundError(validated.value.symbol) };
  }

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

  const remaining = await existingTransactionInputsForSymbol(before.symbol, id);
  const violation = findOversellViolation(remaining);
  if (violation) {
    return { error: formatDeleteOversellError(violation) };
  }

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
