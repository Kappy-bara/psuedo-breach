import type { MedalHolder } from "@/lib/game";

const medal = ["🥇", "🥈", "🥉"];

function t(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  return sec % 60 === 0 ? `${m}m` : `${m}m${String(sec % 60).padStart(2, "0")}`;
}

export function RoomMedals({ medals }: { medals: MedalHolder[] }) {
  if (medals.length === 0) return null;
  return (
    <div className="panel p-3.5">
      <div className="kicker">{"// first in"}</div>
      <ul className="mt-2 space-y-1 text-sm">
        {medals.map((m) => (
          <li key={m.place} className="flex items-baseline gap-2">
            <span>{medal[m.place - 1]}</span>
            <span className="text-ink">{m.displayName}</span>
            <span className="ml-auto text-xs tabular-nums text-ink-faint">{t(m.timeSec)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
