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

  async function reveal(h: HintView) {
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
    <div className="border border-border bg-panel/60 p-5">
      <div className="text-xs tracking-widest text-ink-dim">// HINTS</div>
      <ul className="mt-3 space-y-2">
        {hints.map((h, i) => {
          const shown = open[h.id];
          return (
            <li key={h.id} className="border border-border bg-panel-2/60 p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-ink-dim">
                  hint {i + 1}
                  {h.cost > 0 && <span className="text-accent-amber"> · costs {h.cost} pts</span>}
                  {h.grantsTokenKey && (
                    <span className="text-accent"> · grants &quot;{h.grantsTokenKey}&quot;</span>
                  )}
                </span>
                {!shown &&
                  (h.unlocked || h.contentMd !== null ? (
                    <button
                      onClick={() => reveal(h)}
                      disabled={busy === h.id}
                      className="border border-accent/50 px-2 py-0.5 text-xs text-accent hover:bg-accent hover:text-bg transition-colors"
                    >
                      reveal
                    </button>
                  ) : h.lockedHint.includes("points") ? (
                    <button
                      onClick={() => reveal(h)}
                      disabled={busy === h.id}
                      className="border border-accent-amber/50 px-2 py-0.5 text-xs text-accent-amber hover:bg-accent-amber hover:text-bg transition-colors"
                    >
                      buy
                    </button>
                  ) : (
                    <span className="text-xs text-ink-dim">🔒</span>
                  ))}
              </div>
              {!shown && !h.unlocked && h.contentMd === null && (
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
