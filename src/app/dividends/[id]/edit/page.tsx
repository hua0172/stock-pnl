import { notFound } from "next/navigation";
import type { Market } from "@/lib/pnl";
import { prisma } from "@/lib/prisma";
import { EditDividendForm } from "./edit-form";

export const dynamic = "force-dynamic";

export default async function EditDividendPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const dividend = await prisma.dividend.findUnique({ where: { id } });

  if (!dividend) {
    notFound();
  }

  return (
    <EditDividendForm
      id={id}
      initial={{
        paymentDate: dividend.paymentDate.toISOString().slice(0, 10),
        market: dividend.market as Market,
        symbol: dividend.symbol,
        amount: dividend.amount,
      }}
    />
  );
}
