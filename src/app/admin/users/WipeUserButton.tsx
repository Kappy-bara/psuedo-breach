"use client";

import { wipeUserProgress } from "@/lib/admin";
import { useTransition } from "react";

export function WipeUserButton({ userId }: { userId: string }) {
  const [pending, startTransition] = useTransition();

  const handleWipe = () => {
    if (confirm("WARNING: This will completely erase this user's solves, points, items, and hints. Are you sure?")) {
      startTransition(() => {
        const formData = new FormData();
        formData.append("userId", userId);
        wipeUserProgress(formData);
      });
    }
  };

  return (
    <button
      onClick={handleWipe}
      disabled={pending}
      className="border border-border px-2 py-0.5 text-xs text-accent-red hover:bg-accent-red hover:text-bg disabled:opacity-50"
    >
      {pending ? "…" : "wipe progress"}
    </button>
  );
}
