import { prisma } from "@/lib/db";
import { parseJson } from "@/lib/json";
import { renderPrompt } from "@/lib/prompt";
import { userFlag } from "@/lib/flags";
import { type ItemMap, holds, getInventoryMap } from "@/lib/inventory";
import type { Event, Hint, Item, Module, Puzzle, User } from "@prisma/client";

/* ─────────────────────────── events ─────────────────────────── */

export async function getEventBySlug(slug: string): Promise<Event | null> {
  return prisma.event.findUnique({ where: { slug } });
}

export function eventIsOpen(event: Event): boolean {
  if (event.status === "live") return true;
  if (event.isDemo && event.status !== "ended") return true;
  return false;
}

export function eventPhase(event: Event, now = new Date()): "before" | "open" | "ended" {
  if (event.status === "ended" || now > event.endsAt) return "ended";
  if (eventIsOpen(event)) return "open";
  return "before";
}

/* ─────────────────────────── item catalogue ─────────────────────────── */

export async function getItemCatalog(eventId: string): Promise<Map<string, Item>> {
  const items = await prisma.item.findMany({ where: { eventId } });
  return new Map(items.map((i) => [i.key, i]));
}

/** "🔑 Red Keycard ×1, 🧩 Shard ×2" */
export function describeItemMap(map: ItemMap, catalog: Map<string, Item>): string {
  return (
    Object.entries(map)
      .filter(([, q]) => q > 0)
      .map(([k, q]) => {
        const it = catalog.get(k);
        const label = it ? `${it.icon} ${it.name}` : k;
        return q > 1 ? `${label} ×${q}` : label;
      })
      .join(", ") || "nothing"
  );
}

/* ─────────────────────────── modules ─────────────────────────── */

export interface ModuleCardView {
  slug: string;
  title: string;
  blurb: string;
  theme: string;
  order: number;
  locked: boolean;
  lockedReason: string | null;
  solvedCount: number;
  puzzleCount: number;
  pointsAvailable: number;
  pointsEarned: number;
  cleared: boolean;
}

function moduleLockReason(
  module: Module,
  inv: ItemMap,
  catalog: Map<string, Item>,
  now: Date,
  cleared: boolean,
): string | null {
  if (cleared) return null; // a room you've cleared never re-locks (keycards may get spent later)
  const need = parseJson<ItemMap>(module.prerequisiteItemsJson, {});
  const { ok, missing } = holds(inv, need);
  if (!ok) return `Locked — need ${describeItemMap(missing, catalog)}`;
  if (module.unlockAt && now < module.unlockAt) return `Opens later`;
  return null;
}

export async function getModuleCards(user: User): Promise<ModuleCardView[]> {
  const now = new Date();
  const [modules, inv, catalog, solves] = await Promise.all([
    prisma.module.findMany({
      where: { eventId: user.eventId, isHidden: false },
      orderBy: { order: "asc" },
      include: { puzzles: { where: { isHidden: false } } },
    }),
    getInventoryMap(user.id),
    getItemCatalog(user.eventId),
    prisma.solve.findMany({
      where: { userId: user.id },
      select: { puzzleId: true, basePts: true, bonusPts: true },
    }),
  ]);
  const solveByPuzzle = new Map(solves.map((s) => [s.puzzleId, s]));

  return modules.map((m) => {
    const solved = m.puzzles.filter((p) => solveByPuzzle.has(p.id));
    const cleared = m.puzzles.length > 0 && solved.length === m.puzzles.length;
    const reason = moduleLockReason(m, inv, catalog, now, cleared);
    return {
      slug: m.slug,
      title: m.title,
      blurb: m.blurb,
      theme: m.theme,
      order: m.order,
      locked: reason !== null,
      lockedReason: reason,
      solvedCount: solved.length,
      puzzleCount: m.puzzles.length,
      pointsAvailable: m.puzzles.reduce((a, p) => a + p.basePoints, 0),
      pointsEarned: solved.reduce(
        (a, p) =>
          a + (solveByPuzzle.get(p.id)!.basePts + solveByPuzzle.get(p.id)!.bonusPts),
        0,
      ),
      cleared,
    };
  });
}

/* ─────────────────────────── module detail ─────────────────────────── */

export type HintUnlockRule =
  | { kind: "free" }
  | { kind: "auto-after-wrong"; n: number }
  | { kind: "item"; key: string }
  | { kind: "buy"; cost: number }
  | { kind: "npc" };

export interface HintView {
  id: string;
  order: number;
  unlocked: boolean;
  lockedHint: string;
  buyCost: number | null; // set when the rule is "buy" and it's not unlocked yet
  contentMd: string | null;
}

export interface PuzzleView {
  slug: string;
  title: string;
  promptMd: string;
  type: string;
  basePoints: number;
  difficulty: string;
  solved: boolean;
  solveInfo: { basePts: number; bonusPts: number; solveIndex: number } | null;
  wrongCount: number;
  cooldownUntil: number | null;
  cooldownSec: number;
  wrongCostCreds: number;
  rewardsLabel: string | null;
  leakInSource: string | null;
  domFlagB64: string | null;
}

export interface ModuleDetailView {
  slug: string;
  title: string;
  blurb: string;
  theme: string;
  locked: boolean;
  lockedReason: string | null;
  clearRewardLabel: string | null;
  cleared: boolean;
  puzzles: PuzzleView[];
  hints: HintView[];
}

function hintUnlocked(
  hint: Hint,
  alreadyUnlocked: boolean,
  inv: ItemMap,
  wrongCount: number,
): boolean {
  if (alreadyUnlocked) return true;
  const rule = parseJson<HintUnlockRule>(hint.unlockRule, { kind: "free" });
  switch (rule.kind) {
    case "free":
      return true;
    case "item":
      return (inv[rule.key] ?? 0) > 0;
    case "auto-after-wrong":
      return wrongCount >= rule.n;
    case "buy":
    case "npc":
      return false;
  }
}

function lockedHintLabel(rule: HintUnlockRule, catalog: Map<string, Item>): string {
  switch (rule.kind) {
    case "item": {
      const it = catalog.get(rule.key);
      return `Locked — hold ${it ? `${it.icon} ${it.name}` : rule.key}`;
    }
    case "auto-after-wrong":
      return `Unlocks after ${rule.n} wrong answers`;
    case "buy":
      return `Buy for ${rule.cost} 💰`;
    case "npc":
      return `Only from SUDO`;
    default:
      return "Locked";
  }
}

export async function getModuleDetail(
  user: User,
  slug: string,
): Promise<ModuleDetailView | null> {
  const now = new Date();
  const module = await prisma.module.findUnique({
    where: { eventId_slug: { eventId: user.eventId, slug } },
    include: {
      puzzles: { where: { isHidden: false }, orderBy: { order: "asc" } },
      hints: { orderBy: { order: "asc" } },
    },
  });
  if (!module || module.isHidden) return null;

  const puzzleIds = module.puzzles.map((p) => p.id);
  const [inv, catalog, solves, submissions, hintUnlocks] = await Promise.all([
    getInventoryMap(user.id),
    getItemCatalog(user.eventId),
    prisma.solve.findMany({ where: { userId: user.id, puzzleId: { in: puzzleIds } } }),
    prisma.submission.findMany({
      where: { userId: user.id, puzzleId: { in: puzzleIds }, isCorrect: false },
      orderBy: { createdAt: "desc" },
    }),
    prisma.hintUnlock.findMany({
      where: { userId: user.id, hintId: { in: module.hints.map((h) => h.id) } },
      select: { hintId: true },
    }),
  ]);
  const solveByPuzzle = new Map(solves.map((s) => [s.puzzleId, s]));
  const cleared =
    module.puzzles.length > 0 && module.puzzles.every((p) => solveByPuzzle.has(p.id));
  const reason = moduleLockReason(module, inv, catalog, now, cleared);
  const unlockedHintIds = new Set(hintUnlocks.map((u) => u.hintId));
  const wrongCounts = new Map<string, number>();
  const lastWrong = new Map<string, Date>();
  for (const s of submissions) {
    wrongCounts.set(s.puzzleId, (wrongCounts.get(s.puzzleId) ?? 0) + 1);
    if (!lastWrong.has(s.puzzleId)) lastWrong.set(s.puzzleId, s.createdAt);
  }

  const puzzles: PuzzleView[] = module.puzzles.map((p: Puzzle) => {
    const cfg = parseJson<{
      leakInSource?: boolean;
      answer?: string;
      domFlagB64?: string;
      wrongCostCreds?: number;
    }>(p.validatorConfig, {});
    const solve = solveByPuzzle.get(p.id) ?? null;
    const lw = lastWrong.get(p.id);
    const cd = lw ? lw.getTime() + p.cooldownSec * 1000 : null;
    const rewards = parseJson<ItemMap>(p.rewardsJson, {});
    return {
      slug: p.slug,
      title: p.title,
      promptMd: renderPrompt(p.promptMd, {
        userId: user.id,
        puzzleSlug: p.slug,
        displayName: user.displayName,
        registerId: user.registerId,
      }),
      type: p.type,
      basePoints: p.basePoints,
      difficulty: p.difficulty,
      solved: !!solve,
      solveInfo: solve
        ? { basePts: solve.basePts, bonusPts: solve.bonusPts, solveIndex: solve.solveIndex }
        : null,
      wrongCount: wrongCounts.get(p.id) ?? 0,
      cooldownUntil: cd && cd > Date.now() ? cd : null,
      cooldownSec: p.cooldownSec,
      wrongCostCreds: cfg.wrongCostCreds ?? 0,
      rewardsLabel: Object.keys(rewards).length ? describeItemMap(rewards, catalog) : null,
      leakInSource: cfg.leakInSource && cfg.answer ? cfg.answer : null,
      domFlagB64: cfg.domFlagB64 ?? null,
    };
  });

  const hints: HintView[] = module.hints.map((h) => {
    const rule = parseJson<HintUnlockRule>(h.unlockRule, { kind: "free" });
    const wc = h.puzzleId ? (wrongCounts.get(h.puzzleId) ?? 0) : 0;
    const unlocked = hintUnlocked(h, unlockedHintIds.has(h.id), inv, wc);
    return {
      id: h.id,
      order: h.order,
      unlocked,
      lockedHint: lockedHintLabel(rule, catalog),
      buyCost: !unlocked && rule.kind === "buy" ? rule.cost : null,
      contentMd: unlocked ? h.contentMd : null,
    };
  });

  const clearReward = parseJson<ItemMap>(module.clearRewardJson, {});

  return {
    slug: module.slug,
    title: module.title,
    blurb: module.blurb,
    theme: module.theme,
    locked: reason !== null,
    lockedReason: reason,
    clearRewardLabel: Object.keys(clearReward).length
      ? describeItemMap(clearReward, catalog)
      : null,
    cleared,
    puzzles,
    hints,
  };
}

/* ─────────────────────────── score & leaderboard ─────────────────────────── */

export async function getUserScore(userId: string): Promise<number> {
  const agg = await prisma.solve.aggregate({
    where: { userId },
    _sum: { basePts: true, bonusPts: true },
  });
  return (agg._sum.basePts ?? 0) + (agg._sum.bonusPts ?? 0);
}

export interface LeaderRow {
  rank: number;
  userId: string;
  displayName: string;
  branch: string;
  score: number;
  solveCount: number;
  lastSolveAt: number | null;
  isYou: boolean;
}

const boardCache = new Map<string, { at: number; rows: LeaderRow[] }>();
const BOARD_TTL_MS = 3000;

export async function getLeaderboard(
  eventId: string,
  forUserId?: string,
): Promise<LeaderRow[]> {
  const cached = boardCache.get(eventId);
  if (cached && Date.now() - cached.at < BOARD_TTL_MS) {
    return cached.rows.map((r) => ({ ...r, isYou: r.userId === forUserId }));
  }

  const users = await prisma.user.findMany({
    where: { eventId, role: "participant", isLocked: false },
    select: {
      id: true,
      displayName: true,
      branch: true,
      solves: { select: { basePts: true, bonusPts: true, solvedAt: true } },
    },
  });

  const rows = users
    .map((u) => {
      const score = u.solves.reduce((a, s) => a + s.basePts + s.bonusPts, 0);
      const last = u.solves.reduce<number | null>(
        (mx, s) => Math.max(mx ?? 0, s.solvedAt.getTime()),
        null,
      );
      return {
        userId: u.id,
        displayName: u.displayName,
        branch: u.branch,
        score,
        solveCount: u.solves.length,
        lastSolveAt: last,
        isYou: u.id === forUserId,
      };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        (a.lastSolveAt ?? Infinity) - (b.lastSolveAt ?? Infinity) ||
        a.displayName.localeCompare(b.displayName),
    )
    .map((r, i) => ({ ...r, rank: i + 1 }));

  boardCache.set(eventId, { at: Date.now(), rows });
  return rows;
}

/* ─────────────────────────── announcements ─────────────────────────── */

export async function getAnnouncements(eventId: string, take = 5) {
  return prisma.announcement.findMany({
    where: { eventId },
    orderBy: { createdAt: "desc" },
    take,
  });
}

export { userFlag };
