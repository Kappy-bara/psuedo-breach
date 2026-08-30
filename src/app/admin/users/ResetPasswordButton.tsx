"use client";

import { useActionState } from "react";
import { resetPassword, type ResetState } from "@/lib/admin";

export function ResetPasswordButton({ userId }: { userId: string }) {
  const [state, action, pending] = useActionState<ResetState, FormData>(resetPassword, null);

  return (
    <div className="flex items-center gap-2">
      <form action={action}>
        <input type="hidden" name="userId" value={userId} />
        <button
          disabled={pending}
          className="border border-border px-2 py-0.5 text-xs text-ink-dim hover:border-ink-dim disabled:opacity-50"
        >
          {pending ? "…" : "reset pw"}
        </button>
      </form>
      {state && "password" in state && (
        <code className="bg-accent/10 px-1.5 py-0.5 text-xs text-accent">
          {state.password}
        </code>
      )}
      {state && "error" in state && (
        <span className="text-xs text-accent-red">{state.error}</span>
      )}
    </div>
  );
}
