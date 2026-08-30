"use client";

import { useEffect, useRef, useState } from "react";

type Row = {
  rank: number;
  userId: string;
  displayName: string;
  branch: string;
  score: number;
  solveCount: number;
  isYou: boolean;
};

export function LeaderboardLive({ initial }: { initial: { rows: Row[]; you: Row | null; total: number } }) {
  const [data, setData] = useState(initial);
  const [pulse, setPulse] = useState(false);
  const prevScore = useRef<number | null>(initial.you?.score ?? null);

  useEffect(() => {
    let alive = true;
    async function tick() {
      try {
        const res = await fetch("/api/leaderboard", { cache: "no-store" });
        if (!res.ok) return;
        const next = await res.json();
        if (!alive) return;
        if (next.you && prevScore.current !== null && next.you.score !== prevScore.current) {
          setPulse(true);
          setTimeout(() => setPulse(false), 900);
        }
        prevScore.current = next.you?.score ?? prevScore.current;
        setData(next);
      } catch {}
    }
    const id = setInterval(tick, 5000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between text-xs text-ink-dim">
        <span>{data.total} operators · refreshes every 5s</span>
        {data.you && (
          <span className={pulse ? "text-accent" : ""}>
            you: #{data.you.rank} · {data.you.score} pts
          </span>
        )}
      </div>
      <table className="w-full text-sm">
        <thead className="text-left text-xs tracking-widest text-ink-dim">
          <tr className="border-b border-border">
            <th className="py-2 pr-2">#</th>
            <th className="py-2 pr-2">operator</th>
            <th className="py-2 pr-2 hidden sm:table-cell">branch</th>
            <th className="py-2 pr-2 text-right">solves</th>
            <th className="py-2 text-right">score</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((r) => (
            <tr
              key={r.userId}
              className={`border-b border-border/50 ${
                r.isYou ? "bg-accent/[0.07] text-accent" : ""
              }`}
            >
              <td className="py-1.5 pr-2 tabular-nums">
                {r.rank <= 3 ? ["🥇", "🥈", "🥉"][r.rank - 1] : r.rank}
              </td>
              <td className="py-1.5 pr-2">{r.displayName}</td>
              <td className="py-1.5 pr-2 hidden sm:table-cell text-ink-dim">{r.branch || "—"}</td>
              <td className="py-1.5 pr-2 text-right tabular-nums text-ink-dim">{r.solveCount}</td>
              <td className="py-1.5 text-right tabular-nums font-bold">{r.score}</td>
            </tr>
          ))}
          {data.rows.length === 0 && (
            <tr>
              <td colSpan={5} className="py-6 text-center text-ink-dim">
                nobody&apos;s on the board yet. be the first.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
