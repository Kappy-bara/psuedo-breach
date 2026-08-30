import { prisma } from "@/lib/db";
import { parseJson } from "@/lib/json";
import { renderPrompt } from "@/lib/prompt";
import { userFlag } from "@/lib/flags";
import type { Event, Hint, Module, Puzzle, User } from "@prisma/client";

/* ─────────────────────────── events ─────────────────────────── */

export async function getEventBySlug(slug: string): Promise<Event | null> {
  return prisma.event.findUnique({ where: { slug } });
}

export function eventIsOpen(event: Event, now = new Date()): boolean {
  if (event.status === "live") return true;
  if (event.isDemo && event.status !== "ended") return true;
  return false;
}

export function eventPhase(event: Event, now = new Date()): "before" | "open" | "ended" {
  if (event.status === "ended" || now > event.endsAt) return "ended";
  if (eventIsOpen(event, now)) return "open";
  return "before";
}

/* ─────────────────────────── tokens ─────────────────────────── */

export async function userTokenKeys(userId: string): Promise<Set<string>> {
  const grants = await prisma.tokenGrant.findMany({
    where: { userId },
    select: { key: true },
  });
  return new Set(grants.map((g) => g.key));
}

export async function grantToken(
  userId: string,
  key: string,
  sourcePuzzleId?: string,
): Promise<void> {
  await prisma.tokenGrant.upsert({
    where: { userId_key: { userId, key } },
    update: {},
    create: { userId, key, sourcePuzzleId: sourcePuzzleId ?? null },
  });
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
}

function moduleLockReason(
  module: Module,
  tokens: Set<string>,
  now: Date,
): string | null {
  const prereqs = parseJson<string[]>(module.prerequisiteTokenKeys, []);
  const missing = prereqs.filter((k) => !tokens.has(k));
  if (missing.length) return `Needs token${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}`;
  if (module.unlockAt && now < module.unlockAt)
    return `Unlocks ${module.unlockAt.toISOString()}`;
  return null;
}

export async function getModuleCards(user: User): Promise<ModuleCardView[]> {
  const now = new Date();
  const [modules, tokens, solves] = await Promise.all([
    prisma.module.findMany({
      where: { eventId: user.eventId, isHidden: false },
      orderBy: { order: "asc" },
      include: { puzzles: { where: { isHidden: false } } },
    }),
    userTokenKeys(user.id),
    prisma.solve.findMany({ where: { userId: user.id }, select: { puzzleId: true, basePts: true, bonusPts: true } }),
  ]);
  const solveByPuzzle = new Map(solves.map((s) => [s.puzzleId, s]));

  return modules.map((m) => {
    const reason = moduleLockReason(m, tokens, now);
    const solved = m.puzzles.filter((p) => solveByPuzzle.has(p.id));
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
        (a, p) => a + (solveByPuzzle.get(p.id)!.basePts + solveByPuzzle.get(p.id)!.bonusPts),
        0,
      ),
    };
  });
}

/* ─────────────────────────── module detail ─────────────────────────── */

export type HintUnlockRule =
  | { kind: "free" }
  | { kind: "auto-after-wrong"; n: number }
  | { kind: "token"; key: string }
  | { kind: "terminal"; knockKey: string; requireTokens?: string[]; revealFlagFor?: string }
  | { kind: "paid" };

export interface HintView {
  id: string;
  order: number;
  cost: number;
  unlocked: boolean;
  lockedHint: string;
  contentMd: string | null;
  grantsTokenKey: string | null;
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
  leakInSource: string | null; // a flag string to embed as an HTML comment (demo/orientation)
  domFlagB64: string | null; // for DOM DIMENSION style puzzles
}

export interface ModuleDetailView {
  slug: string;
  title: string;
  blurb: string;
  theme: string;
  locked: boolean;
  lockedReason: string | null;
  puzzles: PuzzleView[];
  hints: HintView[];
}

async function hintIsUnlocked(
  hint: Hint,
  userId: string,
  tokens: Set<string>,
  wrongCounts: Map<string, number>,
): Promise<boolean> {
  const already = await prisma.hintUnlock.findUnique({
    where: { userId_hintId: { userId, hintId: hint.id } },
  });
  if (already) return true;
  const rule = parseJson<HintUnlockRule>(hint.unlockRule, { kind: "free" });
  switch (rule.kind) {
    case "free":
      return true;
    case "token":
      return tokens.has(rule.key);
    case "auto-after-wrong":
      return (wrongCounts.get(hint.puzzleId ?? "") ?? 0) >= rule.n;
    case "terminal":
    case "paid":
      return false;
  }
}

function lockedHintLabel(rule: HintUnlockRule): string {
  switch (rule.kind) {
    case "token":
      return `Locked — needs the "${rule.key}" token`;
    case "auto-after-wrong":
      return `Unlocks automatically after ${rule.n} wrong answers`;
    case "terminal":
      return `Hidden — reachable from the terminal (knock)`;
    case "paid":
      return `Costs points to reveal`;
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

  const tokens = await userTokenKeys(user.id);
  const reason = moduleLockReason(module, tokens, now);

  const puzzleIds = module.puzzles.map((p) => p.id);
  const [solves, submissions] = await Promise.all([
    prisma.solve.findMany({ where: { userId: user.id, puzzleId: { in: puzzleIds } } }),
    prisma.submission.findMany({
      where: { userId: user.id, puzzleId: { in: puzzleIds }, isCorrect: false },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const solveByPuzzle = new Map(solves.map((s) => [s.puzzleId, s]));
  const wrongCounts = new Map<string, number>();
  const lastWrong = new Map<string, Date>();
  for (const s of submissions) {
    wrongCounts.set(s.puzzleId, (wrongCounts.get(s.puzzleId) ?? 0) + 1);
    if (!lastWrong.has(s.puzzleId)) lastWrong.set(s.puzzleId, s.createdAt);
  }

  const puzzles: PuzzleView[] = module.puzzles.map((p: Puzzle) => {
    const cfg = parseJson<{ leakInSource?: boolean; answer?: string; domFlagB64?: string }>(
      p.validatorConfig,
      {},
    );
    const solve = solveByPuzzle.get(p.id) ?? null;
    const lw = lastWrong.get(p.id);
    const cd = lw ? lw.getTime() + p.cooldownSec * 1000 : null;
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
      leakInSource:
        cfg.leakInSource && cfg.answer ? cfg.answer : null,
      domFlagB64: cfg.domFlagB64 ?? null,
    };
  });

  const hints: HintView[] = [];
  for (const h of module.hints) {
    const rule = parseJson<HintUnlockRule>(h.unlockRule, { kind: "free" });
    const unlocked = await hintIsUnlocked(h, user.id, tokens, wrongCounts);
    hints.push({
      id: h.id,
      order: h.order,
      cost: h.cost,
      unlocked,
      lockedHint: lockedHintLabel(rule),
      contentMd: unlocked ? h.contentMd : null,
      grantsTokenKey: h.grantsTokenKey,
    });
  }

  return {
    slug: module.slug,
    title: module.title,
    blurb: module.blurb,
    theme: module.theme,
    locked: reason !== null,
    lockedReason: reason,
    puzzles,
    hints,
  };
}

/* ─────────────────────────── score & leaderboard ─────────────────────────── */

export async function getUserScore(userId: string): Promise<number> {
  const [solveAgg, hintAgg] = await Promise.all([
    prisma.solve.aggregate({
      where: { userId },
      _sum: { basePts: true, bonusPts: true },
    }),
    prisma.hintUnlock.aggregate({ where: { userId }, _sum: { costPaid: true } }),
  ]);
  return (
    (solveAgg._sum.basePts ?? 0) +
    (solveAgg._sum.bonusPts ?? 0) -
    (hintAgg._sum.costPaid ?? 0)
  );
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
      hintUnlocks: { select: { costPaid: true } },
    },
  });

  const rows = users
    .map((u) => {
      const gained = u.solves.reduce((a, s) => a + s.basePts + s.bonusPts, 0);
      const spent = u.hintUnlocks.reduce((a, h) => a + h.costPaid, 0);
      const last = u.solves.reduce<number | null>(
        (mx, s) => Math.max(mx ?? 0, s.solvedAt.getTime()),
        null,
      );
      return {
        userId: u.id,
        displayName: u.displayName,
        branch: u.branch,
        score: gained - spent,
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

/* expose for terminal/knock */
export { userFlag };
