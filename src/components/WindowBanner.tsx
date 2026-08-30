"use client";

import { useEffect, useState } from "react";

function fmt(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s >= 3600) return `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}m`;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function WindowBanner({
  opensAt,
  closesAt,
  locked,
}: {
  opensAt: number | null;
  closesAt: number | null;
  locked: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (locked && opensAt) {
    return (
      <p className="border border-signal/40 bg-signal/[0.06] px-4 py-3 text-sm text-signal">
        ⏰ This room opens in <span className="font-bold tabular-nums">{fmt(opensAt - now)}</span>.
        Come back then — or keep an eye on the map.
      </p>
    );
  }
  if (!locked && closesAt) {
    const left = closesAt - now;
    return (
      <p
        className={`border px-4 py-3 text-sm ${
          left < 120_000
            ? "border-danger/40 bg-danger/[0.06] text-danger"
            : "border-signal/40 bg-signal/[0.06] text-signal"
        }`}
      >
        ⏰ Window closes in <span className="font-bold tabular-nums">{fmt(left)}</span>.
        {" "}Once you&apos;ve had a go it won&apos;t lock you out mid-attempt.
      </p>
    );
  }
  return null;
}
