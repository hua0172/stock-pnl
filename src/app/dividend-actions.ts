"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import type { DividendSnapshot } from "@/lib/dividend-audit-log";
import {
  validateDividendInput,
  type RawDividendInput,
} from "@/lib/dividend-input";
import { fetchHistoricalFxRate } from "@/lib/fx";
import { MARKET_CURRENCY } from "@/lib/market";
import type { DividendInput } from "@/lib/pnl";
import { prisma } from "@/lib/prisma";

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

function revalidateDividendPages() {
  revalidatePath("/");
  revalidatePath("/dividends");
  revalidatePath("/dividends/history");
}

async function createDividend(input: DividendInput) {
  const fxRate = await fetchHistoricalFxRate(
    input.paymentDate,
    MARKET_CURRENCY[input.market],
  );

  const snapshot: DividendSnapshot = { ...input, fxRate };

  return prisma.$transaction(async (tx) => {
    const dividend = await tx.dividend.create({
      data: {
        paymentDate: new Date(input.paymentDate),
        market: input.market,
        symbol: input.symbol,
        amount: input.amount,
        fxRate,
      },
    });

    await tx.dividendAuditLog.create({
      data: {
        action: "CREATE",
        dividendId: dividend.id,
        before: Prisma.DbNull,
        after: snapshot as unknown as Prisma.InputJsonValue,
      },
    });

    return dividend;
  });
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

  try {
    await createDividend(validated.value);
  } catch (err) {
    return { error: formatFxRateError(err) };
  }

  revalidateDividendPages();

  return {};
}
