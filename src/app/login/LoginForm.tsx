"use client";

import { useActionState } from "react";
import { authenticate, type LoginState } from "./actions";

const initial: LoginState = { error: null };

export function LoginForm() {
  const [state, action, pending] = useActionState(authenticate, initial);

  return (
    <form action={action} className="space-y-4">
      <label className="block">
        <span className="kicker">register id</span>
        <input
          name="registerId"
          autoComplete="username"
          autoCapitalize="characters"
          required
          className="mt-1 w-full border border-border bg-panel-2 px-3 py-2 font-mono text-ink outline-none focus:border-accent"
          placeholder="PB-XXXX-00"
        />
      </label>
      <label className="block">
        <span className="kicker">password</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1 w-full border border-border bg-panel-2 px-3 py-2 font-mono text-ink outline-none focus:border-accent"
          placeholder="••••••••"
        />
      </label>

      {state.error && (
        <p className="border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className="btn w-full">
        {pending ? "authenticating…" : "[ jack in ]"}
      </button>
    </form>
  );
}
