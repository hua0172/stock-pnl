"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { deleteTransaction } from "@/app/actions";

export function DeleteTransactionButton({ id }: { id: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!window.confirm("確定要刪除這筆交易嗎？此動作無法復原。")) {
      return;
    }

    startTransition(async () => {
      const result = await deleteTransaction(id);
      if (result.error) {
        window.alert(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="text-red-600 underline disabled:opacity-50 dark:text-red-400"
    >
      {isPending ? "刪除中…" : "刪除"}
    </button>
  );
}
