"use client";

import { useEffect, useState } from "react";
import type { YearRow } from "@/lib/game";

export function YearBoard({ initial }: { initial: YearRow[] }) {
  const [rows, setRows] = useState(initial);

  useEffect(() => {
    let alive = true;
    async function tick() {
      try {
        const res = await fetch("/api/leaderboard?view=years", { cache: "no-store" });
        if (!res.ok || !alive) return;
        const data = await res.json();
        setRows(data.years as YearRow[]);
      } catch {}
    }
    const id = setInterval(tick, 8000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const max = Math.max(1, ...rows.map((r) => r.totalScore));

  return (
    <div className="space-y-3">
      {rows.length === 0 && <p className="text-sm text-ink-faint">no scores yet.</p>}
      {rows.map((r, i) => (
        <div key={r.year} className="panel p-3.5">
          <div className="flex items-baseline justify-between">
            <span className="font-display text-lg font-bold">
              {r.year === "—" ? "Unassigned" : `Year ${r.year}`}
            </span>
            <span className="text-sm tabular-nums text-ink">
              {r.totalScore.toLocaleString()} pts
            </span>
          </div>
          <div className="mt-2 h-2 w-full bg-panel-2">
            <div
              className={`h-full ${i === 0 ? "bg-verified" : "bg-accent"}`}
              style={{ width: `${(r.totalScore / max) * 100}%` }}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-xs text-ink-faint">
            <span>
              {r.members} operator{r.members === 1 ? "" : "s"} · {r.solves} solves
            </span>
            <span>top: {r.topPlayer || "—"}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
