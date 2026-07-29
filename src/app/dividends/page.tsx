import Link from "next/link";
import { MARKET_LABEL } from "@/lib/market";
import type { Market } from "@/lib/pnl";
import { prisma } from "@/lib/prisma";
import { DeleteDividendButton } from "./delete-button";

export const dynamic = "force-dynamic";

export default async function DividendsPage() {
  const dividends = await prisma.dividend.findMany({
    orderBy: { paymentDate: "asc" },
  });

  return (
    <div className="flex flex-1 flex-col gap-6 bg-zinc-50 p-8 font-sans dark:bg-black">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
          股息列表
        </h1>
        <div className="flex gap-4">
          <Link
            href="/dividends/new"
            className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background"
          >
            新增股息
          </Link>
          <Link href="/dividends/history" className="text-sm underline">
            股息異動紀錄
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
              <th className="p-3">發放日期</th>
              <th className="p-3">市場</th>
              <th className="p-3">股票代號</th>
              <th className="p-3">金額</th>
              <th className="p-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {dividends.map((d) => (
              <tr
                key={d.id}
                className="border-b border-black/[.04] last:border-0 dark:border-white/[.08]"
              >
                <td className="whitespace-nowrap p-3">
                  {d.paymentDate.toISOString().slice(0, 10)}
                </td>
                <td className="p-3">{MARKET_LABEL[d.market as Market]}</td>
                <td className="p-3 font-medium">{d.symbol}</td>
                <td className="p-3">{d.amount}</td>
                <td className="p-3">
                  <div className="flex gap-3">
                    <Link href={`/dividends/${d.id}/edit`} className="underline">
                      編輯
                    </Link>
                    <DeleteDividendButton id={d.id} />
                  </div>
                </td>
              </tr>
            ))}
            {dividends.length === 0 && (
              <tr>
                <td className="p-6 text-center text-zinc-500" colSpan={5}>
                  還沒有任何股息紀錄。
                  <Link href="/dividends/new" className="underline">
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
