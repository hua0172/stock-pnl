"use client";

import Link from "next/link";
import { useActionState } from "react";
import { importTransactionsCsv, type ImportResult } from "@/app/actions";

const initialState: ImportResult | null = null;

export default function ImportTransactionsPage() {
  const [state, formAction, pending] = useActionState(
    importTransactionsCsv,
    initialState,
  );

  return (
    <div className="flex flex-1 flex-col gap-6 bg-zinc-50 p-8 font-sans dark:bg-black">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
          匯入 CSV
        </h1>
        <Link href="/" className="text-sm underline">
          回報表頁
        </Link>
      </header>

      <div className="max-w-xl rounded-lg border border-black/[.08] bg-white p-6 text-sm dark:border-white/[.145] dark:bg-zinc-900">
        <p className="font-medium">預期欄位（順序不拘）：</p>
        <code className="mt-2 block overflow-x-auto rounded bg-zinc-100 p-3 dark:bg-zinc-800">
          trade_date,market,symbol,side,quantity,price
        </code>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-zinc-600 dark:text-zinc-400">
          <li>
            <code>trade_date</code>（交易日期）：<code>YYYY-MM-DD</code>
          </li>
          <li>
            <code>market</code>（市場）：<code>TW</code> 或 <code>US</code>
          </li>
          <li>
            <code>side</code>（買賣別）：<code>BUY</code> 或 <code>SELL</code>
          </li>
          <li>
            <code>quantity</code>（股數）與 <code>price</code>（價格）：正數
          </li>
        </ul>
      </div>

      <form
        action={formAction}
        className="flex max-w-xl flex-col gap-4 rounded-lg border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-900"
      >
        <label className="flex flex-col gap-1 text-sm">
          CSV 檔案
          <input
            type="file"
            name="file"
            accept=".csv,text/csv"
            required
            className="rounded border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-zinc-800"
          />
        </label>

        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
        >
          {pending ? "匯入中…" : "匯入"}
        </button>
      </form>

      {state && (
        <div className="max-w-xl rounded-lg border border-black/[.08] bg-white p-6 text-sm dark:border-white/[.145] dark:bg-zinc-900">
          <p className="font-medium">已匯入 {state.createdCount} 筆交易。</p>
          {state.errors.length > 0 && (
            <>
              <p className="mt-3 font-medium text-red-700 dark:text-red-300">
                {state.errors.length} 筆資料失敗：
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-red-700 dark:text-red-300">
                {state.errors.map((err, i) => (
                  <li key={i}>
                    {err.row > 0 ? `第 ${err.row} 列：` : ""}
                    {err.message}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
