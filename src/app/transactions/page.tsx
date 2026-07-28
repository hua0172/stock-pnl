import Link from "next/link";
import { MARKET_LABEL } from "@/lib/market";
import type { Market, Side } from "@/lib/pnl";
import { prisma } from "@/lib/prisma";
import { DeleteTransactionButton } from "./delete-button";

export const dynamic = "force-dynamic";

const SIDE_LABEL: Record<Side, string> = { BUY: "買進", SELL: "賣出" };

export default async function TransactionsPage() {
  const transactions = await prisma.transaction.findMany({
    orderBy: { tradeDate: "asc" },
  });

  return (
    <div className="flex flex-1 flex-col gap-6 bg-zinc-50 p-8 font-sans dark:bg-black">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
          交易列表
        </h1>
        <div className="flex gap-4">
          <Link
            href="/transactions/new"
            className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background"
          >
            新增交易
          </Link>
          <Link href="/transactions/history" className="text-sm underline">
            異動紀錄
          </Link>
          <Link href="/" className="text-sm underline">
            回報表頁
          </Link>
        </div>
      </header>

      <section className="overflow-x-auto rounded-lg border border-black/[.08] bg-white dark:border-white/[.145] dark:bg-zinc-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-black/[.08] text-zinc-500 dark:border-white/[.145]">
            <tr>
              <th className="p-3">交易日期</th>
              <th className="p-3">市場</th>
              <th className="p-3">股票代號</th>
              <th className="p-3">買賣別</th>
              <th className="p-3">股數</th>
              <th className="p-3">價格</th>
              <th className="p-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => (
              <tr
                key={t.id}
                className="border-b border-black/[.04] last:border-0 dark:border-white/[.08]"
              >
                <td className="whitespace-nowrap p-3">
                  {t.tradeDate.toISOString().slice(0, 10)}
                </td>
                <td className="p-3">{MARKET_LABEL[t.market as Market]}</td>
                <td className="p-3 font-medium">{t.symbol}</td>
                <td className="p-3">{SIDE_LABEL[t.side as Side]}</td>
                <td className="p-3">{t.quantity}</td>
                <td className="p-3">{t.price}</td>
                <td className="p-3">
                  <div className="flex gap-3">
                    <Link href={`/transactions/${t.id}/edit`} className="underline">
                      編輯
                    </Link>
                    <DeleteTransactionButton id={t.id} />
                  </div>
                </td>
              </tr>
            ))}
            {transactions.length === 0 && (
              <tr>
                <td className="p-6 text-center text-zinc-500" colSpan={7}>
                  還沒有任何交易紀錄。
                  <Link href="/transactions/new" className="underline">
                    新增一筆
                  </Link>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
