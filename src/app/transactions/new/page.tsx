"use client";

import Link from "next/link";
import { useActionState } from "react";
import { addTransaction, type ActionResult } from "@/app/actions";

const initialState: ActionResult = {};

export default function NewTransactionPage() {
  const [state, formAction, pending] = useActionState(
    addTransaction,
    initialState,
  );

  return (
    <div className="flex flex-1 flex-col gap-6 bg-zinc-50 p-8 font-sans dark:bg-black">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
          新增交易
        </h1>
        <Link href="/" className="text-sm underline">
          回報表頁
        </Link>
      </header>

      <form
        action={formAction}
        className="flex max-w-md flex-col gap-4 rounded-lg border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-900"
      >
        <label className="flex flex-col gap-1 text-sm">
          交易日期
          <input
            type="date"
            name="tradeDate"
            required
            className="rounded border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-zinc-800"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          市場
          <select
            name="market"
            required
            className="rounded border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-zinc-800"
          >
            <option value="TW">台股（TW）</option>
            <option value="US">美股（US）</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          股票代號
          <input
            type="text"
            name="symbol"
            required
            placeholder="例如 2330 或 AAPL"
            className="rounded border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-zinc-800"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          買賣別
          <select
            name="side"
            required
            className="rounded border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-zinc-800"
          >
            <option value="BUY">買進</option>
            <option value="SELL">賣出</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          股數
          <input
            type="number"
            name="quantity"
            required
            min="0"
            step="any"
            className="rounded border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-zinc-800"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          成交價格（原幣別）
          <input
            type="number"
            name="price"
            required
            min="0"
            step="any"
            className="rounded border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-zinc-800"
          />
        </label>

        {state.error && (
          <p className="rounded bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
        >
          {pending ? "儲存中…" : "儲存交易"}
        </button>
      </form>
    </div>
  );
}
