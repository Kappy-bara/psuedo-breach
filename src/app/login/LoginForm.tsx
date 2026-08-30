"use client";

import { useActionState } from "react";
import { authenticate, type LoginState } from "./actions";

const initial: LoginState = { error: null };

export function LoginForm() {
  const [state, action, pending] = useActionState(authenticate, initial);

  return (
    <form action={action} className="space-y-4">
      <label className="block">
        <span className="text-xs tracking-widest text-ink-dim">REGISTER ID</span>
        <input
          name="registerId"
          autoComplete="username"
          autoCapitalize="characters"
          required
          className="mt-1 w-full border border-border bg-panel-2 px-3 py-2 text-ink outline-none focus:border-accent"
          placeholder="PB-XXXX-00"
        />
      </label>
      <label className="block">
        <span className="text-xs tracking-widest text-ink-dim">PASSWORD</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1 w-full border border-border bg-panel-2 px-3 py-2 text-ink outline-none focus:border-accent"
          placeholder="••••••••"
        />
      </label>

      {state.error && (
        <p className="border border-accent-red/40 bg-accent-red/10 px-3 py-2 text-sm text-accent-red">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full border border-accent bg-accent/10 px-4 py-2.5 font-bold text-accent hover:bg-accent hover:text-bg disabled:opacity-50 transition-colors"
      >
        {pending ? "authenticating…" : "[ log in ]"}
      </button>
    </form>
  );
}
