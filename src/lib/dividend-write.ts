import { Prisma } from "@/generated/prisma/client";
import { fetchHistoricalFxRate } from "./fx";
import { MARKET_CURRENCY } from "./market";
import type { DividendInput } from "./pnl";
import { prisma } from "./prisma";
import type { DividendSnapshot } from "./dividend-audit-log";

// Shared by manual dividend entry (src/app/dividend-actions.ts) and the auto
// dividend-detection scan (src/lib/dividend-detection.ts) — both need the
// exact same create-plus-audit-log behavior, so an auto-detected dividend is
// indistinguishable from a manually-entered one.
export async function createDividend(input: DividendInput) {
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
