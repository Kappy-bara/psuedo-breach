"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

export type ToastTone = "ok" | "loot" | "signal" | "info";
export interface Toast {
  id: number;
  tone: ToastTone;
  title: string;
  body?: string;
}

const Ctx = createContext<(t: Omit<Toast, "id">) => void>(() => {});
export const useToast = () => useContext(Ctx);

const toneStyle: Record<ToastTone, string> = {
  ok: "border-verified/50 bg-verified/[0.08] text-verified",
  loot: "border-signal/50 bg-signal/[0.08] text-signal",
  signal: "border-signal/60 bg-signal/[0.12] text-signal",
  info: "border-border-bright bg-panel-2 text-ink",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(1);

  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = next.current++;
    setToasts((cur) => [...cur, { ...t, id }].slice(-4));
    const ms = t.tone === "signal" ? 6000 : 4200;
    setTimeout(() => setToasts((cur) => cur.filter((x) => x.id !== id)), ms);
  }, []);

  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[9998] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast-in pointer-events-auto border px-3.5 py-2.5 text-sm shadow-lg ${toneStyle[t.tone]}`}
          >
            <div className="font-bold tracking-tight">{t.title}</div>
            {t.body && <div className="mt-0.5 text-xs text-ink-dim">{t.body}</div>}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
