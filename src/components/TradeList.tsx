"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Markdown } from "@/components/Markdown";
import type { TradeView } from "@/lib/trade";

export type ItemInfo = { icon: string; name: string; type: string };

function describe(map: Record<string, number>, catalog: Record<string, ItemInfo>) {
  const parts = Object.entries(map)
    .filter(([, q]) => q > 0)
    .map(([k, q]) => {
      const it = catalog[k];
      const label = it ? `${it.icon} ${it.name}` : k;
      return q > 1 ? `${label} ×${q}` : label;
    });
  return parts.length ? parts.join(", ") : "nothing";
}

export function TradeList({
  trades,
  catalog,
}: {
  trades: TradeView[];
  catalog: Record<string, ItemInfo>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<Record<string, { ok: boolean; text: string }>>({});
  const [banner, setBanner] = useState<string | null>(null);

  async function trade(t: TradeView) {
    setBusy(t.id);
    setNote((n) => ({ ...n, [t.id]: { ok: true, text: "" } }));
    try {
      const res = await fetch("/api/trade", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tradeId: t.id }),
      });
      const data = await res.json();
      const r = data.result;
      if (r?.status === "ok") {
        setBanner(`✓ ${t.label} — you got ${describe(r.got, catalog)}`);
        router.refresh();
      } else if (r?.status === "short") {
        setNote((n) => ({
          ...n,
          [t.id]: { ok: false, text: `you're short: ${describe(r.missing, catalog)}` },
        }));
      } else if (r?.status === "done") {
        setNote((n) => ({ ...n, [t.id]: { ok: false, text: "already done that one." } }));
      } else {
        setNote((n) => ({ ...n, [t.id]: { ok: false, text: data.error ?? "no." } }));
      }
    } catch {
      setNote((n) => ({ ...n, [t.id]: { ok: false, text: "network error." } }));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      {banner && (
        <p className="flash-in border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent">
          {banner}
        </p>
      )}
      {trades.length === 0 ? (
        <p className="panel p-4 text-sm text-ink-dim">
          SUDO has nothing for you right now. Come back with more loot.
        </p>
      ) : (
        <ul className="space-y-3">
      {trades.map((t) => {
        const n = note[t.id];
        return (
          <li key={t.id} className="panel p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-bold">{t.label}</div>
                {t.descriptionMd && (
                  <Markdown className="mt-1 text-sm text-ink-dim">{t.descriptionMd}</Markdown>
                )}
                <div className="mt-2 text-sm">
                  <span className="text-accent-red">give</span> {describe(t.give, catalog)}
                  <span className="mx-2 text-ink-dim">→</span>
                  <span className="text-accent">get</span> {describe(t.get, catalog)}
                </div>
              </div>
              <button
                onClick={() => trade(t)}
                disabled={busy === t.id || t.alreadyDone || !t.affordable}
                className="shrink-0 border border-accent bg-accent/10 px-4 py-1.5 text-sm font-bold text-accent transition-colors hover:bg-accent hover:text-bg disabled:opacity-40"
              >
                {t.alreadyDone
                  ? "done"
                  : busy === t.id
                    ? "…"
                    : t.affordable
                      ? "trade"
                      : "can't afford"}
              </button>
            </div>
            {n && !n.ok && (
              <p className="mt-2 text-sm text-accent-red">{n.text}</p>
            )}
          </li>
        );
      })}
        </ul>
      )}
    </div>
  );
}
