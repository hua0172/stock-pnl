import { notFound } from "next/navigation";
import type { Market, Side } from "@/lib/pnl";
import { prisma } from "@/lib/prisma";
import { EditTransactionForm } from "./edit-form";

export const dynamic = "force-dynamic";

export default async function EditTransactionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const transaction = await prisma.transaction.findUnique({ where: { id } });

  if (!transaction) {
    notFound();
  }

  return (
    <EditTransactionForm
      id={id}
      initial={{
        tradeDate: transaction.tradeDate.toISOString().slice(0, 10),
        market: transaction.market as Market,
        symbol: transaction.symbol,
        side: transaction.side as Side,
        quantity: transaction.quantity,
        price: transaction.price,
      }}
    />
  );
}
