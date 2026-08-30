/**
 * The room-unlock engine. Pure and unit-tested — no DB, no clock of its own.
 *
 * A room's `unlockRuleJson` is one of these rules. `evaluateUnlock` folds the
 * rule + a context (inventory, cleared rooms, the clock) into a single state
 * the map and the submit handler both read.
 */
import { type ItemMap, holds } from "@/lib/inventory";

export type UnlockRule =
  | { open: true }
  | { items: Record<string, number> } // hold these (keycards etc.)
  | { clearedRooms: string[] } // have cleared these room slugs
  | { windowAt: { from: string; to: string } } // one-shot absolute ISO window
  | { recurring: { everyMin: number; openMin: number; offsetMin?: number } } // relative to event start
  | { all: UnlockRule[] } // AND
  | { any: UnlockRule[] }; // OR

export type UnlockKind = "open" | "item" | "time" | "prereq" | "mixed";

export interface UnlockCtx {
  inv: ItemMap;
  clearedSlugs: Set<string>;
  /** rooms where the player has ≥1 submission — grants "grace" past a closed window */
  touchedSlugs: Set<string>;
  now: number; // epoch ms
  eventStart: number; // epoch ms
  slug: string; // the room being evaluated
  itemName?: (key: string) => string;
}

export interface UnlockState {
  unlocked: boolean;
  reason: string | null;
  opensAt: number | null; // epoch ms — drives the countdown
  closesAt: number | null;
  kind: UnlockKind;
}

const fmt = (ms: number) => {
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
};

function combineKind(kinds: UnlockKind[]): UnlockKind {
  const set = new Set(kinds.filter((k) => k !== "open"));
  if (set.size === 0) return "open";
  if (set.size === 1) return [...set][0]!;
  return "mixed";
}

function evalOne(rule: UnlockRule, ctx: UnlockCtx): UnlockState {
  const name = ctx.itemName ?? ((k: string) => k);
  const grace = ctx.touchedSlugs.has(ctx.slug) && !ctx.clearedSlugs.has(ctx.slug);

  if ("open" in rule) {
    return { unlocked: true, reason: null, opensAt: null, closesAt: null, kind: "open" };
  }

  if ("items" in rule) {
    const { ok, missing } = holds(ctx.inv, rule.items);
    return {
      unlocked: ok,
      reason: ok
        ? null
        : `Needs ${Object.entries(missing)
            .map(([k, q]) => (q > 1 ? `${name(k)} ×${q}` : name(k)))
            .join(", ")}`,
      opensAt: null,
      closesAt: null,
      kind: "item",
    };
  }

  if ("clearedRooms" in rule) {
    const missing = rule.clearedRooms.filter((s) => !ctx.clearedSlugs.has(s));
    return {
      unlocked: missing.length === 0,
      reason: missing.length ? `Clear ${missing.join(" & ")} first` : null,
      opensAt: null,
      closesAt: null,
      kind: "prereq",
    };
  }

  if ("windowAt" in rule) {
    const from = Date.parse(rule.windowAt.from);
    const to = Date.parse(rule.windowAt.to);
    if (ctx.now < from) {
      return { unlocked: false, reason: `Opens ${fmt(from)}`, opensAt: from, closesAt: to, kind: "time" };
    }
    if (ctx.now <= to || grace) {
      return {
        unlocked: true,
        reason: grace && ctx.now > to ? "Window closed — finish up" : null,
        opensAt: null,
        closesAt: ctx.now <= to ? to : null,
        kind: "time",
      };
    }
    return { unlocked: false, reason: `Closed ${fmt(to)}`, opensAt: null, closesAt: null, kind: "time" };
  }

  if ("recurring" in rule) {
    const { everyMin, openMin, offsetMin = 0 } = rule.recurring;
    const cycle = everyMin * 60_000;
    const openMs = openMin * 60_000;
    const base = ctx.eventStart + offsetMin * 60_000;

    if (ctx.now < base) {
      return { unlocked: false, reason: `Opens ${fmt(base)}`, opensAt: base, closesAt: base + openMs, kind: "time" };
    }
    const phase = (ctx.now - base) % cycle;
    if (phase < openMs) {
      const closesAt = ctx.now - phase + openMs;
      return { unlocked: true, reason: null, opensAt: null, closesAt, kind: "time" };
    }
    if (grace) {
      return { unlocked: true, reason: "Window closed — finish up", opensAt: null, closesAt: null, kind: "time" };
    }
    const opensAt = ctx.now - phase + cycle;
    return { unlocked: false, reason: `Opens ${fmt(opensAt)}`, opensAt, closesAt: opensAt + openMs, kind: "time" };
  }

  if ("all" in rule) {
    const parts = rule.all.map((r) => evalOne(r, ctx));
    const unlocked = parts.every((p) => p.unlocked);
    const blocking = parts.filter((p) => !p.unlocked);
    // AND opens when the LAST gate opens
    const timed = blocking.filter((p) => p.opensAt != null);
    const hardBlocked = blocking.some((p) => p.opensAt == null);
    return {
      unlocked,
      reason: unlocked ? null : (blocking[0]?.reason ?? "Locked"),
      opensAt: hardBlocked || !timed.length ? null : Math.max(...timed.map((p) => p.opensAt!)),
      closesAt: unlocked ? (parts.map((p) => p.closesAt).filter((x): x is number => x != null).sort((a, b) => a - b)[0] ?? null) : null,
      kind: combineKind(parts.map((p) => p.kind)),
    };
  }

  if ("any" in rule) {
    const parts = rule.any.map((r) => evalOne(r, ctx));
    const unlocked = parts.some((p) => p.unlocked);
    // OR opens when the FIRST gate opens
    const timed = parts.filter((p) => p.opensAt != null);
    return {
      unlocked,
      reason: unlocked ? null : (timed.sort((a, b) => a.opensAt! - b.opensAt!)[0]?.reason ?? parts[0]?.reason ?? "Locked"),
      opensAt: unlocked || !timed.length ? null : Math.min(...timed.map((p) => p.opensAt!)),
      closesAt: null,
      kind: combineKind(parts.map((p) => p.kind)),
    };
  }

  return { unlocked: false, reason: "Locked", opensAt: null, closesAt: null, kind: "prereq" };
}

export function parseUnlockRule(json: string): UnlockRule {
  try {
    const r = JSON.parse(json);
    if (r && typeof r === "object") return r as UnlockRule;
  } catch {}
  return { open: true };
}

export function evaluateUnlock(rule: UnlockRule, ctx: UnlockCtx): UnlockState {
  return evalOne(rule, ctx);
}
