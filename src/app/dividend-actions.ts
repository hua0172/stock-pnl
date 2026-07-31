"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import type { Dividend } from "@/generated/prisma/client";
import type { DividendSnapshot } from "@/lib/dividend-audit-log";
import {
  validateDividendInput,
  type RawDividendInput,
} from "@/lib/dividend-input";
import { createDividend } from "@/lib/dividend-write";
import { fetchHistoricalFxRate } from "@/lib/fx";
import { MARKET_CURRENCY } from "@/lib/market";
import type { Market } from "@/lib/pnl";
import { prisma } from "@/lib/prisma";
import { verifySymbolExists } from "@/lib/symbol-existence";

function snapshotFromRecord(record: Dividend): DividendSnapshot {
  return {
    paymentDate: record.paymentDate.toISOString().slice(0, 10),
    market: record.market as Market,
    symbol: record.symbol,
    amount: record.amount,
    fxRate: record.fxRate,
  };
}

function parseDividendFormData(formData: FormData): RawDividendInput {
  return {
    paymentDate: String(formData.get("paymentDate") ?? ""),
    market: String(formData.get("market") ?? ""),
    symbol: String(formData.get("symbol") ?? ""),
    amount: String(formData.get("amount") ?? ""),
  };
}

function formatFxRateError(err: unknown): string {
  return `無法取得此發放日期的匯率：${(err as Error).message}`;
}

function formatSymbolNotFoundError(symbol: string): string {
  return `找不到股票代號「${symbol}」，請確認代號是否正確。`;
}

async function findExistingDividend(
  id: string,
): Promise<{ existing: Dividend; before: DividendSnapshot } | { error: string }> {
  const existing = await prisma.dividend.findUnique({ where: { id } });
  if (!existing) {
    return { error: "找不到這筆股息紀錄，可能已經被刪除。" };
  }

  return { existing, before: snapshotFromRecord(existing) };
}

function revalidateDividendPages() {
  revalidatePath("/");
  revalidatePath("/dividends");
  revalidatePath("/dividends/history");
}

export interface DividendActionResult {
  error?: string;
}

export async function addDividend(
  _prevState: DividendActionResult,
  formData: FormData,
): Promise<DividendActionResult> {
  const validated = validateDividendInput(parseDividendFormData(formData));

  if (!validated.value) {
    return { error: validated.error };
  }

  const existence = await verifySymbolExists(validated.value.market, validated.value.symbol);
  if (existence.confirmedAbsent) {
    return { error: formatSymbolNotFoundError(validated.value.symbol) };
  }

  try {
    await createDividend(validated.value);
  } catch (err) {
    return { error: formatFxRateError(err) };
  }

  revalidateDividendPages();

  return {};
}

export async function updateDividend(
  id: string,
  _prevState: DividendActionResult,
  formData: FormData,
): Promise<DividendActionResult> {
  const validated = validateDividendInput(parseDividendFormData(formData));

  if (!validated.value) {
    return { error: validated.error };
  }

  const found = await findExistingDividend(id);
  if ("error" in found) {
    return { error: found.error };
  }

  const existence = await verifySymbolExists(validated.value.market, validated.value.symbol);
  if (existence.confirmedAbsent) {
    return { error: formatSymbolNotFoundError(validated.value.symbol) };
  }

  const { before } = found;
  const dateOrMarketChanged =
    before.paymentDate !== validated.value.paymentDate ||
    before.market !== validated.value.market;

  let fxRate = before.fxRate;
  if (dateOrMarketChanged) {
    try {
      fxRate = await fetchHistoricalFxRate(
        validated.value.paymentDate,
        MARKET_CURRENCY[validated.value.market],
      );
    } catch (err) {
      return { error: formatFxRateError(err) };
    }
  }

  const after: DividendSnapshot = { ...validated.value, fxRate };

  await prisma.$transaction(async (tx) => {
    await tx.dividend.update({
      where: { id },
      data: {
        paymentDate: new Date(after.paymentDate),
        market: after.market,
        symbol: after.symbol,
        amount: after.amount,
        fxRate: after.fxRate,
      },
    });

    await tx.dividendAuditLog.create({
      data: {
        action: "UPDATE",
        dividendId: id,
        before: before as unknown as Prisma.InputJsonValue,
        after: after as unknown as Prisma.InputJsonValue,
      },
    });
  });

  revalidateDividendPages();

  return {};
}

export async function deleteDividend(id: string): Promise<DividendActionResult> {
  const found = await findExistingDividend(id);
  if ("error" in found) {
    return { error: found.error };
  }

  const { before } = found;

  await prisma.$transaction(async (tx) => {
    await tx.dividend.delete({ where: { id } });

    await tx.dividendAuditLog.create({
      data: {
        action: "DELETE",
        dividendId: id,
        before: before as unknown as Prisma.InputJsonValue,
        after: Prisma.DbNull,
      },
    });
  });

  revalidateDividendPages();

  return {};
}
