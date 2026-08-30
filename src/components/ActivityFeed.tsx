"use client";

import { useEffect, useState } from "react";
import type { FeedRow } from "@/lib/feed";

const kindIcon: Record<string, string> = {
  "first-blood": "🩸",
  solve: "✓",
  "room-clear": "🚪",
  forge: "🔧",
  achievement: "🎖️",
  milestone: "★",
};

function ago(ms: number): string {
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
}

export function ActivityFeed({
  initial,
  compact = false,
}: {
  initial: FeedRow[];
  compact?: boolean;
}) {
  const [rows, setRows] = useState<FeedRow[]>(initial);
  // ids present when the feed first mounted — anything new since then flashes in once
  const [mountIds] = useState(() => new Set(initial.map((r) => r.id)));

  useEffect(() => {
    let alive = true;
    async function tick() {
      try {
        const res = await fetch("/api/feed", { cache: "no-store" });
        if (!res.ok || !alive) return;
        const data = await res.json();
        setRows(data.rows as FeedRow[]);
      } catch {}
    }
    const id = setInterval(tick, 8000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  if (compact) {
    const r = rows[0];
    return (
      <div className="truncate text-xs text-ink-dim">
        {r ? (
          <>
            <span className="mr-1">{kindIcon[r.kind] ?? "·"}</span>
            {r.title}
            <span className="ml-1 text-ink-faint">· {ago(r.at)}</span>
          </>
        ) : (
          "no activity yet — be the first"
        )}
      </div>
    );
  }

  return (
    <ul className="space-y-1.5">
      {rows.length === 0 && (
        <li className="text-sm text-ink-faint">nothing yet. someone has to go first.</li>
      )}
      {rows.map((r) => {
        const fresh = !mountIds.has(r.id);
        return (
          <li
            key={r.id}
            className={`flex items-baseline gap-2 text-sm ${fresh ? "flash-in" : ""} ${
              r.kind === "first-blood" ? "text-signal" : "text-ink-dim"
            }`}
          >
            <span className="w-4 shrink-0 text-center">{kindIcon[r.kind] ?? "·"}</span>
            <span className={r.kind === "first-blood" ? "font-semibold" : ""}>{r.title}</span>
            <span className="ml-auto shrink-0 text-xs text-ink-faint">{ago(r.at)}</span>
          </li>
        );
      })}
    </ul>
  );
}
