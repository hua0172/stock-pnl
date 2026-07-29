import Link from "next/link";
import {
  describeDividendAuditEntry,
  type DividendSnapshot,
} from "@/lib/dividend-audit-log";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function formatTimestamp(date: Date): string {
  return new Intl.DateTimeFormat("zh-TW", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default async function DividendHistoryPage() {
  const entries = await prisma.dividendAuditLog.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-1 flex-col gap-6 bg-zinc-50 p-8 font-sans dark:bg-black">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
          股息異動紀錄
        </h1>
        <div className="flex gap-4">
          <Link href="/dividends" className="text-sm underline">
            股息列表
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
              <th className="p-3">時間</th>
              <th className="p-3">動作</th>
              <th className="p-3">內容</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => {
              const described = describeDividendAuditEntry({
                action: entry.action,
                before: entry.before as DividendSnapshot | null,
                after: entry.after as DividendSnapshot | null,
              });

              return (
                <tr
                  key={entry.id}
                  className="border-b border-black/[.04] last:border-0 dark:border-white/[.08]"
                >
                  <td className="whitespace-nowrap p-3 text-zinc-500">
                    {formatTimestamp(entry.createdAt)}
                  </td>
                  <td className="p-3 font-medium">{described.actionLabel}</td>
                  <td className="p-3">{described.summary}</td>
                </tr>
              );
            })}
            {entries.length === 0 && (
              <tr>
                <td className="p-6 text-center text-zinc-500" colSpan={3}>
                  還沒有任何股息異動紀錄。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
