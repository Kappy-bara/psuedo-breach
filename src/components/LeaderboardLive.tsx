"use client";

import { useEffect, useRef, useState } from "react";
import { YearBoard } from "@/components/YearBoard";
import type { YearRow } from "@/lib/game";

type Row = {
  rank: number;
  userId: string;
  displayName: string;
  year: string;
  title: string;
  score: number;
  solveCount: number;
  isYou: boolean;
};

export function LeaderboardLive({
  initial,
}: {
  initial: { rows: Row[]; you: Row | null; total: number; years: YearRow[] };
}) {
  const [tab, setTab] = useState<"operators" | "years">("operators");
  const [data, setData] = useState(initial);
  const [pulse, setPulse] = useState(false);
  const prevScore = useRef<number | null>(initial.you?.score ?? null);

  useEffect(() => {
    let alive = true;
    async function tick() {
      try {
        const res = await fetch("/api/leaderboard", { cache: "no-store" });
        if (!res.ok || !alive) return;
        const next = await res.json();
        if (next.you && prevScore.current !== null && next.you.score !== prevScore.current) {
          setPulse(true);
          setTimeout(() => setPulse(false), 900);
        }
        prevScore.current = next.you?.score ?? prevScore.current;
        setData((d) => ({ ...d, rows: next.rows, you: next.you, total: next.total }));
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
      <div className="mb-4 flex items-center gap-1 border-b border-border">
        {(["operators", "years"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-3 py-1.5 text-sm transition-colors ${
              tab === t
                ? "border-accent text-accent"
                : "border-transparent text-ink-dim hover:text-ink"
            }`}
          >
            {t}
          </button>
        ))}
        <span className="ml-auto text-xs text-ink-faint">
          {data.total} operators · live
          {data.you && (
            <span className={`ml-2 ${pulse ? "text-verified" : "text-ink-dim"}`}>
              you #{data.you.rank} · {data.you.score}
            </span>
          )}
        </span>
      </div>

      {tab === "years" ? (
        <YearBoard initial={data.years} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs tracking-widest text-ink-faint">
              <tr className="border-b border-border">
                <th className="py-2 pr-2">#</th>
                <th className="py-2 pr-2">operator</th>
                <th className="hidden py-2 pr-2 sm:table-cell">yr</th>
                <th className="py-2 pr-2 text-right">solves</th>
                <th className="py-2 text-right">score</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr
                  key={r.userId}
                  className={`border-b border-border/50 ${r.isYou ? "bg-accent/[0.08] text-accent" : ""}`}
                >
                  <td className="py-1.5 pr-2 tabular-nums">
                    {r.rank <= 3 ? ["🥇", "🥈", "🥉"][r.rank - 1] : r.rank}
                  </td>
                  <td className="py-1.5 pr-2">
                    {r.displayName}
                    {r.title && (
                      <span className="ml-1.5 text-xs font-normal text-ink-faint">
                        {r.title}
                      </span>
                    )}
                  </td>
                  <td className="hidden py-1.5 pr-2 tabular-nums text-ink-dim sm:table-cell">
                    {r.year || "—"}
                  </td>
                  <td className="py-1.5 pr-2 text-right tabular-nums text-ink-dim">
                    {r.solveCount}
                  </td>
                  <td className="py-1.5 text-right font-bold tabular-nums">{r.score}</td>
                </tr>
              ))}
              {data.rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-ink-faint">
                    nobody&apos;s on the board yet. be the first.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
