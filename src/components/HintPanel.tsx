"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Markdown } from "@/components/Markdown";
import type { HintView } from "@/lib/game";

export function HintPanel({ hints }: { hints: HintView[] }) {
  const router = useRouter();
  const [open, setOpen] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<Record<string, string>>({});

  async function act(h: HintView) {
    if (h.contentMd) {
      setOpen((o) => ({ ...o, [h.id]: h.contentMd! }));
      return;
    }
    setBusy(h.id);
    setErr((e) => ({ ...e, [h.id]: "" }));
    try {
      const res = await fetch("/api/hint", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ hintId: h.id }),
      });
      const data = await res.json();
      if (data.unlocked) {
        setOpen((o) => ({ ...o, [h.id]: data.contentMd }));
        router.refresh();
      } else {
        setErr((e) => ({ ...e, [h.id]: data.error ?? "Locked." }));
      }
    } catch {
      setErr((e) => ({ ...e, [h.id]: "Network error." }));
    } finally {
      setBusy(null);
    }
  }

  if (hints.length === 0) return null;

  return (
    <div className="panel p-5">
      <div className="text-xs tracking-widest text-ink-dim">// INTEL</div>
      <ul className="mt-3 space-y-2">
        {hints.map((h, i) => {
          const shown = open[h.id] ?? h.contentMd;
          return (
            <li key={h.id} className="border border-border bg-panel-2/60 p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-ink-dim">intel {i + 1}</span>
                {!shown &&
                  (h.unlocked ? (
                    <button
                      onClick={() => act(h)}
                      disabled={busy === h.id}
                      className="border border-accent/50 px-2 py-0.5 text-xs text-accent transition-colors hover:bg-accent hover:text-bg"
                    >
                      reveal
                    </button>
                  ) : h.buyCost !== null ? (
                    <button
                      onClick={() => act(h)}
                      disabled={busy === h.id}
                      className="border border-accent-amber/50 px-2 py-0.5 text-xs text-accent-amber transition-colors hover:bg-accent-amber hover:text-bg"
                    >
                      buy · {h.buyCost} 💰
                    </button>
                  ) : (
                    <span className="text-xs text-ink-dim">🔒</span>
                  ))}
              </div>
              {!shown && !h.unlocked && h.buyCost === null && (
                <div className="mt-1 text-xs text-ink-dim">{h.lockedHint}</div>
              )}
              {err[h.id] && <div className="mt-1 text-xs text-accent-red">{err[h.id]}</div>}
              {shown && (
                <div className="mt-2 border-t border-border pt-2">
                  <Markdown>{shown}</Markdown>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
