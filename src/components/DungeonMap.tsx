"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import type { ModuleCardView } from "@/lib/game";

const CELL = 132;
const NW = 104;
const NH = 60;
const PAD = 74;

/**
 * A shared 1 Hz clock. `getSnapshot` must return a *stable* value between ticks
 * (a fresh `Date.now()` each call would spin `useSyncExternalStore` forever), so
 * the current time is cached and only advanced on the interval. `getServerSnapshot`
 * returns 0 — the server and the hydrating client render "soon" rather than a
 * timestamp that could never match, so there's no hydration mismatch.
 */
let clockNow = 0;
let clockTimer: ReturnType<typeof setInterval> | null = null;
const clockSubs = new Set<() => void>();

function clockSubscribe(cb: () => void): () => void {
  clockSubs.add(cb);
  if (!clockTimer) {
    clockNow = Date.now();
    clockTimer = setInterval(() => {
      clockNow = Date.now();
      clockSubs.forEach((fn) => fn());
    }, 1000);
  }
  return () => {
    clockSubs.delete(cb);
    if (clockSubs.size === 0 && clockTimer) {
      clearInterval(clockTimer);
      clockTimer = null;
    }
  };
}
const noopSubscribe = () => () => {};

function useClock(active: boolean): number {
  return useSyncExternalStore(
    active ? clockSubscribe : noopSubscribe,
    () => clockNow,
    () => 0,
  );
}

function shortTitle(t: string) {
  return t.replace(/^[A-Z]\d+\s*·\s*/, "");
}

function fmtDelta(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s >= 3600) return `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}m`;
  if (s >= 600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function DungeonMap({ rooms }: { rooms: ModuleCardView[] }) {
  const router = useRouter();
  const [hover, setHover] = useState<string | null>(null);
  const wrap = useRef<HTMLDivElement>(null);

  const hasCountdown = rooms.some((r) => r.opensAt || r.closesAt);
  const now = useClock(hasCountdown);

  const minX = Math.min(...rooms.map((r) => r.mapX), 0);
  const minY = Math.min(...rooms.map((r) => r.mapY), 0);
  const maxX = Math.max(...rooms.map((r) => r.mapX), 0);
  const maxY = Math.max(...rooms.map((r) => r.mapY), 0);
  const W = (maxX - minX) * CELL + PAD * 2;
  const H = (maxY - minY) * CELL + PAD * 2;
  const px = (gx: number) => PAD + (gx - minX) * CELL;
  const py = (gy: number) => PAD + (gy - minY) * CELL;

  const zones = new Map<string, { minX: number; minY: number; maxX: number; maxY: number }>();
  for (const r of rooms) {
    if (!r.mapZone) continue;
    const z = zones.get(r.mapZone) ?? { minX: r.mapX, minY: r.mapY, maxX: r.mapX, maxY: r.mapY };
    z.minX = Math.min(z.minX, r.mapX);
    z.minY = Math.min(z.minY, r.mapY);
    z.maxX = Math.max(z.maxX, r.mapX);
    z.maxY = Math.max(z.maxY, r.mapY);
    zones.set(r.mapZone, z);
  }

  const bySlug = new Map(rooms.map((r) => [r.slug, r]));
  const edges: [ModuleCardView, ModuleCardView][] = [];
  const seen = new Set<string>();
  for (const r of rooms)
    for (const e of r.edges) {
      const o = bySlug.get(e);
      if (!o) continue;
      const key = [r.slug, o.slug].sort().join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push([r, o]);
    }

  type NState =
    | "cleared"
    | "open"
    | "progress"
    | "time-soon"
    | "time-past"
    | "need-item"
    | "locked";
  function nodeState(r: ModuleCardView): NState {
    if (r.cleared) return "cleared";
    if (!r.locked) return r.solvedCount > 0 ? "progress" : "open";
    if (r.unlockKind === "time") return r.opensAt ? "time-soon" : "time-past";
    if (r.unlockKind === "item") return "need-item";
    return "locked";
  }

  return (
    <div>
      <div ref={wrap} className="overflow-x-auto [&>svg]:mx-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          style={{ minWidth: Math.min(W, 560), maxWidth: W * 1.25 }}
          role="img"
          aria-label="Map of THE STACK"
        >
          <defs>
            <pattern id="mapgrid" width="33" height="33" patternUnits="userSpaceOnUse">
              <path d="M33 0H0V33" fill="none" stroke="rgba(120,150,190,0.07)" strokeWidth="1" />
            </pattern>
          </defs>
          <style>{`
            @keyframes dash {
              to { stroke-dashoffset: -1000; }
            }
            @keyframes pulse-glow {
              0%, 100% { filter: drop-shadow(0 0 2px var(--color-accent)); }
              50% { filter: drop-shadow(0 0 10px var(--color-accent)); }
            }
          `}</style>
          
          <rect x="0" y="0" width={W} height={H} fill="url(#mapgrid)" />

          {/* zones */}
          {Array.from(zones.entries()).map(([name, box]) => {
            const x = px(box.minX) - CELL / 2;
            const y = py(box.minY) - CELL / 2 - 10;
            const w = (box.maxX - box.minX + 1) * CELL;
            const h = (box.maxY - box.minY + 1) * CELL + 20;
            return (
              <g key={name}>
                <rect x={x} y={y} width={w} height={h} fill="var(--color-panel)" opacity="0.3" stroke="var(--color-border)" strokeWidth="1" strokeDasharray="8 4" rx="12" />
                <text x={x + 14} y={y + 22} fontFamily="var(--font-display)" fontSize="12" fontWeight="bold" fill="var(--color-ink-dim)" letterSpacing="0.2em" style={{ textTransform: 'uppercase' }}>
                  [ {name} ]
                </text>
              </g>
            );
          })}

          {/* corridors */}
          {edges.map(([a, b], i) => {
            const live = !a.locked && !b.locked;
            return (
              <g key={i}>
                {live ? (
                  <>
                    <line x1={px(a.mapX)} y1={py(a.mapY)} x2={px(b.mapX)} y2={py(b.mapY)} strokeWidth="6" stroke="var(--color-accent)" opacity="0.15" />
                    <line x1={px(a.mapX)} y1={py(a.mapY)} x2={px(b.mapX)} y2={py(b.mapY)} strokeWidth="2" stroke="var(--color-accent)" strokeDasharray="6 6" style={{ animation: 'dash 30s linear infinite' }} />
                  </>
                ) : (
                  <line x1={px(a.mapX)} y1={py(a.mapY)} x2={px(b.mapX)} y2={py(b.mapY)} strokeWidth="1.5" stroke="var(--color-border)" />
                )}
              </g>
            );
          })}

          {/* nodes */}
          {rooms.map((r) => {
            const st = nodeState(r);
            const x = px(r.mapX) - NW / 2;
            const y = py(r.mapY) - NH / 2;
            const clickable = r.cleared || !r.locked;
            const chamfer = 9;
            const path = `M${x + chamfer} ${y} H${x + NW - chamfer} L${x + NW} ${y + chamfer} V${y + NH - chamfer} L${x + NW - chamfer} ${y + NH} H${x + chamfer} L${x} ${y + NH - chamfer} V${y + chamfer} Z`;

            let fill = "var(--color-panel-2)";
            let stroke = "var(--color-border-bright)";
            let opacity = 1;
            let sub = "";
            let glyph = "";
            if (st === "cleared") {
              fill = "color-mix(in srgb, var(--color-verified) 14%, var(--color-panel))";
              stroke = "var(--color-verified)";
              glyph = "✓";
            } else if (st === "open") {
              stroke = "var(--color-accent)";
              fill = "color-mix(in srgb, var(--color-accent) 10%, var(--color-panel))";
            } else if (st === "progress") {
              stroke = "var(--color-accent)";
              fill = "color-mix(in srgb, var(--color-accent) 10%, var(--color-panel))";
              sub = `${r.solvedCount}/${r.puzzleCount} solved`;
            } else if (st === "time-soon") {
              stroke = "var(--color-signal)";
              fill = "color-mix(in srgb, var(--color-signal) 8%, var(--color-panel))";
              glyph = "⏰";
              sub = r.opensAt ? `opens ${now ? fmtDelta(r.opensAt - now) : "soon"}` : "";
            } else if (st === "time-past") {
              opacity = 0.8;
              stroke = "var(--color-ink-faint)";
              glyph = "✕";
              sub = "closed";
            } else if (st === "need-item") {
              opacity = 0.9;
              stroke = "var(--color-ink-faint)";
              glyph = "🔑";
              sub = (r.lockedReason ?? "").replace(/^Needs\s+/, "");
            } else {
              opacity = 0.85;
              stroke = "var(--color-ink-faint)";
              glyph = "🔒";
              sub = "locked";
            }
            if (!r.locked && r.closesAt) sub = `closes ${now ? fmtDelta(r.closesAt - now) : "soon"}`;

            return (
              <g
                key={r.slug}
                opacity={opacity}
                style={{ cursor: clickable ? "pointer" : "default" }}
                onMouseEnter={() => setHover(r.slug)}
                onMouseLeave={() => setHover((h) => (h === r.slug ? null : h))}
                onClick={() => clickable && router.push(`/modules/${r.slug}`)}
              >
                <path
                  d={path}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={hover === r.slug && clickable ? 2 : 1.25}
                  style={st === "open" || st === "progress" ? { animation: "pulse-glow 3s ease-in-out infinite" } : undefined}
                />
                {st === "open" && (
                  <path d={path} fill="none" stroke="var(--color-accent)" strokeWidth="1.25" style={{ animation: "node-pulse 2.4s ease-in-out infinite" }} />
                )}
                <text
                  x={px(r.mapX)}
                  y={py(r.mapY) - 3}
                  textAnchor="middle"
                  fontFamily="var(--font-display)"
                  fontWeight="700"
                  fontSize="10.5"
                  fill={st === "cleared" || st === "open" || st === "progress" ? "var(--color-ink)" : "var(--color-ink-dim)"}
                >
                  {shortTitle(r.title).slice(0, 15)}
                </text>
                <text
                  x={px(r.mapX)}
                  y={py(r.mapY) + 12}
                  textAnchor="middle"
                  fontFamily="var(--font-mono)"
                  fontSize="8"
                  fill={st === "time-soon" ? "var(--color-signal)" : "var(--color-ink-dim)"}
                >
                  {glyph ? `${glyph} ` : ""}
                  {sub.slice(0, 22)}
                </text>
                {r.yourMedal && (
                  <text x={x + NW - 6} y={y + 13} textAnchor="end" fontSize="12">
                    {r.yourMedal === "gold" ? "🥇" : r.yourMedal === "silver" ? "🥈" : "🥉"}
                  </text>
                )}
              </g>
            );
          })}

          <text x={PAD - 40} y={H - 14} fontFamily="var(--font-mono)" fontSize="9" fill="var(--color-ink-faint)" letterSpacing="0.15em">
            PLAN — THE STACK
          </text>
        </svg>
      </div>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-faint">
        <span><span className="text-verified">■</span> cleared</span>
        <span><span className="text-accent">■</span> open</span>
        <span>🔑 needs a keycard</span>
        <span className="text-signal">⏰ timed — countdown live</span>
        <span>🔒 locked</span>
      </div>
    </div>
  );
}
