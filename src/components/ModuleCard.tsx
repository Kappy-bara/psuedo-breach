import Link from "next/link";
import type { ModuleCardView } from "@/lib/game";

const themeAccent: Record<string, string> = {
  green: "text-accent",
  cyan: "text-accent-cyan",
  amber: "text-accent-amber",
  magenta: "text-accent-magenta",
  red: "text-accent-red",
  default: "text-ink",
};

export function ModuleCard({ m }: { m: ModuleCardView }) {
  const done = m.puzzleCount > 0 && m.solvedCount === m.puzzleCount;
  const accent = themeAccent[m.theme] ?? themeAccent.default;

  const inner = (
    <div
      className={`group h-full border p-4 transition-colors ${
        m.locked
          ? "border-border bg-panel/40 opacity-70"
          : done
            ? "border-accent/50 bg-accent/[0.06]"
            : "border-border bg-panel/60 hover:border-ink-dim"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className={`text-xs font-bold tracking-widest ${accent}`}>{m.title}</span>
        <span className="text-xs text-ink-dim">
          {m.locked ? "🔒" : done ? "✓ cleared" : `${m.solvedCount}/${m.puzzleCount}`}
        </span>
      </div>
      <p className="mt-2 text-sm text-ink-dim line-clamp-3">{m.blurb}</p>
      <div className="mt-3 flex items-center justify-between text-xs text-ink-dim">
        <span>
          {m.locked ? (
            <span className="text-accent-amber">{m.lockedReason}</span>
          ) : (
            <>
              <span className="text-ink">{m.pointsEarned}</span> / {m.pointsAvailable} pts
            </>
          )}
        </span>
        {!m.locked && <span className="text-ink-dim group-hover:text-ink">open →</span>}
      </div>
    </div>
  );

  if (m.locked) return <div>{inner}</div>;
  return <Link href={`/modules/${m.slug}`}>{inner}</Link>;
}
