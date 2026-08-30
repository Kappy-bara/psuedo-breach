import Link from "next/link";
import type { ModuleCardView } from "@/lib/game";

const themeAccent: Record<string, string> = {
  green: "text-verified",
  cyan: "text-accent",
  amber: "text-signal",
  magenta: "text-accent-magenta",
  red: "text-danger",
  default: "text-ink",
};

export function ModuleCard({ m }: { m: ModuleCardView }) {
  const done = m.cleared;
  const accent = themeAccent[m.theme] ?? themeAccent.default;
  const pct = m.puzzleCount ? Math.round((m.solvedCount / m.puzzleCount) * 100) : 0;

  const inner = (
    <div
      className={`panel panel-hover relative flex h-full flex-col p-4 ${
        m.locked ? "opacity-55 grayscale-[0.5]" : ""
      } ${done ? "border-verified/45 bg-verified/[0.05]" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className={`font-display text-xs font-bold tracking-[0.1em] ${accent}`}>
          {m.title}
        </span>
        <span className="shrink-0 font-mono text-xs text-ink-dim">
          {m.cleared
            ? "✓"
            : m.locked
              ? m.unlockKind === "time"
                ? "⏰"
                : m.unlockKind === "item"
                  ? "🔑"
                  : "🔒"
              : `${m.solvedCount}/${m.puzzleCount}`}
          {m.yourMedal &&
            " " + (m.yourMedal === "gold" ? "🥇" : m.yourMedal === "silver" ? "🥈" : "🥉")}
        </span>
      </div>

      <p className="mt-2 line-clamp-3 flex-1 text-sm text-ink-dim">{m.blurb}</p>

      {!m.locked && m.puzzleCount > 0 && (
        <div className="mt-3 h-0.5 w-full bg-border">
          <div
            className={`h-full ${done ? "bg-verified" : "bg-ink-faint"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      <div className="mt-2 flex items-center justify-between text-xs">
        {m.locked ? (
          <span className="text-signal">{m.lockedReason}</span>
        ) : (
          <span className="text-ink-dim">
            <span className="text-ink">{m.pointsEarned}</span> / {m.pointsAvailable} pts
          </span>
        )}
        {!m.locked && <span className="text-ink-faint">enter →</span>}
      </div>
    </div>
  );

  if (m.locked) return <div>{inner}</div>;
  return (
    <Link href={`/modules/${m.slug}`} className="block h-full">
      {inner}
    </Link>
  );
}
