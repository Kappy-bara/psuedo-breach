import { prisma } from "@/lib/db";
import { parseJson } from "@/lib/json";
import { renderPrompt } from "@/lib/prompt";
import { userFlag } from "@/lib/flags";
import { type ItemMap, getInventoryMap } from "@/lib/inventory";
import {
  evaluateUnlock,
  parseUnlockRule,
  type UnlockCtx,
  type UnlockKind,
} from "@/lib/unlock";
import type { Event, Hint, Item, Puzzle, User } from "@prisma/client";

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

/* ─────────────────────────── the map / rooms ─────────────────────────── */

export type Medal = "gold" | "silver" | "bronze" | null;

export interface ModuleCardView {
  slug: string;
  title: string;
  blurb: string;
  theme: string;
  order: number;
  mapX: number;
  mapY: number;
  mapZone: string;
  edges: string[];
  locked: boolean;
  lockedReason: string | null;
  unlockKind: UnlockKind;
  opensAt: number | null;
  closesAt: number | null;
  solvedCount: number;
  puzzleCount: number;
  pointsAvailable: number;
  pointsEarned: number;
  cleared: boolean;
  yourMedal: Medal;
}

function unlockCtxFor(
  user: User,
  event: Event,
  inv: ItemMap,
  clearedSlugs: Set<string>,
  touchedSlugs: Set<string>,
  slug: string,
  catalog: Map<string, Item>,
): UnlockCtx {
  return {
    inv,
    clearedSlugs,
    touchedSlugs,
    now: Date.now(),
    eventStart: event.startsAt.getTime(),
    slug,
    itemName: (k) => catalog.get(k)?.name ?? k,
  };
}

export async function getModuleCards(user: User): Promise<ModuleCardView[]> {
  const event = await prisma.event.findUniqueOrThrow({ where: { id: user.eventId } });
  const [modules, inv, catalog, solves, wrongSubs] = await Promise.all([
    prisma.module.findMany({
      where: { eventId: user.eventId, isHidden: false },
      orderBy: { order: "asc" },
      include: { puzzles: { where: { isHidden: false } } },
    }),
    getInventoryMap(user.id),
    getItemCatalog(user.eventId),
    prisma.solve.findMany({
      where: { userId: user.id },
      select: { puzzleId: true, solveIndex: true, basePts: true, bonusPts: true },
    }),
    prisma.submission.findMany({
      where: { userId: user.id },
      select: { puzzle: { select: { moduleId: true } } },
    }),
  ]);
  const solveByPuzzle = new Map(solves.map((s) => [s.puzzleId, s]));

  const bySlug = new Map(modules.map((m) => [m.id, m.slug]));
  const clearedSlugs = new Set<string>();
  const touchedSlugs = new Set<string>();
  for (const m of modules) {
    const done = m.puzzles.length > 0 && m.puzzles.every((p) => solveByPuzzle.has(p.id));
    if (done) clearedSlugs.add(m.slug);
  }
  for (const s of wrongSubs) {
    const slug = bySlug.get(s.puzzle.moduleId);
    if (slug) touchedSlugs.add(slug);
  }
  // a solve also counts as "touched"
  for (const m of modules)
    if (m.puzzles.some((p) => solveByPuzzle.has(p.id))) touchedSlugs.add(m.slug);

  return modules.map((m) => {
    const solved = m.puzzles.filter((p) => solveByPuzzle.has(p.id));
    const cleared = m.puzzles.length > 0 && solved.length === m.puzzles.length;
    const rule = parseUnlockRule(m.unlockRuleJson);
    const state = evaluateUnlock(
      rule,
      unlockCtxFor(user, event, inv, clearedSlugs, touchedSlugs, m.slug, catalog),
    );
    const locked = !cleared && !state.unlocked;

    // your best medal in this room (lowest solveIndex across its puzzles)
    const bestIdx = Math.min(
      ...m.puzzles.map((p) => solveByPuzzle.get(p.id)?.solveIndex ?? 99),
    );
    const yourMedal: Medal =
      bestIdx <= 2 ? (["gold", "silver", "bronze"][bestIdx] as Medal) : null;

    return {
      slug: m.slug,
      title: m.title,
      blurb: m.blurb,
      theme: m.theme,
      order: m.order,
      mapX: m.mapX,
      mapY: m.mapY,
      mapZone: m.mapZone,
      edges: parseJson<string[]>(m.mapEdgesJson, []),
      locked,
      lockedReason: locked ? state.reason : null,
      unlockKind: state.kind,
      opensAt: state.opensAt,
      closesAt: cleared ? null : state.closesAt,
      solvedCount: solved.length,
      puzzleCount: m.puzzles.length,
      pointsAvailable: m.puzzles.reduce((a, p) => a + p.basePoints, 0),
      pointsEarned: solved.reduce(
        (a, p) =>
          a + (solveByPuzzle.get(p.id)!.basePts + solveByPuzzle.get(p.id)!.bonusPts),
        0,
      ),
      cleared,
      yourMedal,
    };
  });
}

/* ─────────────────────────── room medals ─────────────────────────── */

export interface MedalHolder {
  place: 1 | 2 | 3;
  displayName: string;
  timeSec: number;
}

export async function getRoomMedals(puzzleIds: string[]): Promise<MedalHolder[]> {
  if (puzzleIds.length === 0) return [];
  const solves = await prisma.solve.findMany({
    where: { puzzleId: { in: puzzleIds }, solveIndex: { lte: 2 } },
    orderBy: { solveIndex: "asc" },
    select: { solveIndex: true, timeToSolveSec: true, user: { select: { displayName: true } } },
  });
  return solves.slice(0, 3).map((s) => ({
    place: (s.solveIndex + 1) as 1 | 2 | 3,
    displayName: s.user.displayName,
    timeSec: s.timeToSolveSec,
  }));
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
  buyCost: number | null;
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
  opensAt: number | null;
  closesAt: number | null;
  clearRewardLabel: string | null;
  cleared: boolean;
  puzzles: PuzzleView[];
  hints: HintView[];
  medals: MedalHolder[];
}

function hintUnlocked(hint: Hint, alreadyUnlocked: boolean, inv: ItemMap, wrongCount: number): boolean {
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
      return `Only from the Shop`;
    default:
      return "Locked";
  }
}

export async function getModuleDetail(
  user: User,
  slug: string,
): Promise<ModuleDetailView | null> {
  const event = await prisma.event.findUniqueOrThrow({ where: { id: user.eventId } });
  const room = await prisma.module.findUnique({
    where: { eventId_slug: { eventId: user.eventId, slug } },
    include: {
      puzzles: { where: { isHidden: false }, orderBy: { order: "asc" } },
      hints: { orderBy: { order: "asc" } },
    },
  });
  if (!room || room.isHidden) return null;

  const puzzleIds = room.puzzles.map((p) => p.id);
  const [inv, catalog, solves, submissions, hintUnlocks, medals, allSolves] = await Promise.all([
    getInventoryMap(user.id),
    getItemCatalog(user.eventId),
    prisma.solve.findMany({ where: { userId: user.id, puzzleId: { in: puzzleIds } } }),
    prisma.submission.findMany({
      where: { userId: user.id, puzzleId: { in: puzzleIds }, isCorrect: false },
      orderBy: { createdAt: "desc" },
    }),
    prisma.hintUnlock.findMany({
      where: { userId: user.id, hintId: { in: room.hints.map((h) => h.id) } },
      select: { hintId: true },
    }),
    getRoomMedals(puzzleIds),
    prisma.solve.findMany({ where: { userId: user.id }, select: { puzzle: { select: { moduleId: true, module: { select: { slug: true } } } } } }),
  ]);
  const solveByPuzzle = new Map(solves.map((s) => [s.puzzleId, s]));
  const cleared =
    room.puzzles.length > 0 && room.puzzles.every((p) => solveByPuzzle.has(p.id));

  // unlock state — need cleared + touched across all rooms
  const allModules = await prisma.module.findMany({
    where: { eventId: user.eventId },
    select: { slug: true, id: true, puzzles: { select: { id: true } } },
  });
  const mySolvedPuzzleIds = new Set(
    (await prisma.solve.findMany({ where: { userId: user.id }, select: { puzzleId: true } })).map(
      (s) => s.puzzleId,
    ),
  );
  const clearedSlugs = new Set(
    allModules
      .filter((m) => m.puzzles.length > 0 && m.puzzles.every((p) => mySolvedPuzzleIds.has(p.id)))
      .map((m) => m.slug),
  );
  const touchedSlugs = new Set(allSolves.map((s) => s.puzzle.module.slug));
  const myWrong = await prisma.submission.findMany({
    where: { userId: user.id, isCorrect: false },
    select: { puzzle: { select: { module: { select: { slug: true } } } } },
  });
  for (const w of myWrong) touchedSlugs.add(w.puzzle.module.slug);

  const state = cleared
    ? { unlocked: true, reason: null, opensAt: null, closesAt: null }
    : evaluateUnlock(parseUnlockRule(room.unlockRuleJson), {
        inv,
        clearedSlugs,
        touchedSlugs,
        now: Date.now(),
        eventStart: event.startsAt.getTime(),
        slug: room.slug,
        itemName: (k) => catalog.get(k)?.name ?? k,
      });

  const unlockedHintIds = new Set(hintUnlocks.map((u) => u.hintId));
  const wrongCounts = new Map<string, number>();
  const lastWrong = new Map<string, Date>();
  for (const s of submissions) {
    wrongCounts.set(s.puzzleId, (wrongCounts.get(s.puzzleId) ?? 0) + 1);
    if (!lastWrong.has(s.puzzleId)) lastWrong.set(s.puzzleId, s.createdAt);
  }

  const puzzles: PuzzleView[] = room.puzzles.map((p: Puzzle) => {
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

  const hints: HintView[] = room.hints.map((h) => {
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

  const clearReward = parseJson<ItemMap>(room.clearRewardJson, {});

  return {
    slug: room.slug,
    title: room.title,
    blurb: room.blurb,
    theme: room.theme,
    locked: !state.unlocked,
    lockedReason: state.unlocked ? null : state.reason,
    opensAt: state.opensAt,
    closesAt: state.closesAt,
    clearRewardLabel: Object.keys(clearReward).length
      ? describeItemMap(clearReward, catalog)
      : null,
    cleared,
    puzzles,
    hints,
    medals,
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
  year: string;
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
      year: true,
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
        year: u.year,
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

export interface YearRow {
  year: string;
  totalScore: number;
  members: number;
  solves: number;
  topPlayer: string;
}

export async function getYearBoard(eventId: string): Promise<YearRow[]> {
  const rows = await getLeaderboard(eventId);
  const byYear = new Map<string, YearRow & { _topScore: number }>();
  for (const r of rows) {
    const y = r.year || "—";
    const cur =
      byYear.get(y) ??
      ({ year: y, totalScore: 0, members: 0, solves: 0, topPlayer: "", _topScore: -1 } as YearRow & {
        _topScore: number;
      });
    cur.totalScore += r.score;
    cur.members += 1;
    cur.solves += r.solveCount;
    if (r.score > cur._topScore) {
      cur._topScore = r.score;
      cur.topPlayer = r.displayName;
    }
    byYear.set(y, cur);
  }
  return [...byYear.values()]
    .map(
      (r): YearRow => ({
        year: r.year,
        totalScore: r.totalScore,
        members: r.members,
        solves: r.solves,
        topPlayer: r.topPlayer,
      }),
    )
    .sort((a, b) => b.totalScore - a.totalScore);
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
