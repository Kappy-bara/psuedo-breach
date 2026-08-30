import { prisma } from "@/lib/db";
import { parseJson } from "@/lib/json";
import { getCreds, grantItems, getInventoryMap } from "@/lib/inventory";
import { parseUnlockRule } from "@/lib/unlock";
import { emitFeed } from "@/lib/feed";

export type AchRule =
  | { kind: "map-runner"; n: number }
  | { kind: "no-hint-clear"; n: number }
  | { kind: "flawless-clear"; n: number }
  | { kind: "speed"; withinSec: number }
  | { kind: "first-blood"; n: number }
  | { kind: "creds-held"; amount: number }
  | { kind: "big-spender"; spent: number }
  | { kind: "all-rooms" }
  | { kind: "all-trophies" }
  | { kind: "after"; iso: string }
  | { kind: "time-room" };

export interface UnlockedAch {
  key: string;
  name: string;
  icon: string;
  title: string;
  credReward: number;
}

/** Everything a rule can be judged against — derived once, then checked purely. */
export interface AchSnapshot {
  clearedRooms: number;
  totalRooms: number;
  noHintClears: number;
  flawlessClears: number;
  clearedTimeRooms: number;
  fastestSolveSec: number;
  firstBloods: number;
  credsHeld: number;
  credsSpent: number;
  holdsAllTrophies: boolean;
  latestSolveMs: number;
}

/** Pure: does this snapshot satisfy the rule? Unit-tested in tests/achievements.test.ts. */
export function evaluateAchRule(rule: AchRule, s: AchSnapshot): boolean {
  switch (rule.kind) {
    case "map-runner":
      return s.clearedRooms >= rule.n;
    case "all-rooms":
      return s.totalRooms > 0 && s.clearedRooms >= s.totalRooms;
    case "no-hint-clear":
      return s.noHintClears >= rule.n;
    case "flawless-clear":
      return s.flawlessClears >= rule.n;
    case "speed":
      return s.fastestSolveSec <= rule.withinSec;
    case "first-blood":
      return s.firstBloods >= rule.n;
    case "creds-held":
      return s.credsHeld >= rule.amount;
    case "big-spender":
      return s.credsSpent >= rule.spent;
    case "all-trophies":
      return s.holdsAllTrophies;
    case "after":
      return s.latestSolveMs >= Date.parse(rule.iso);
    case "time-room":
      return s.clearedTimeRooms >= 1;
    default:
      return false;
  }
}

/**
 * Re-evaluates every not-yet-earned achievement for a user. Cheap enough to run
 * after each solve / trade (a handful of scoped queries). Returns anything newly
 * unlocked so the caller can toast it.
 */
export async function checkAchievements(
  userId: string,
  eventId: string,
): Promise<UnlockedAch[]> {
  const [catalog, unlocked, user] = await Promise.all([
    prisma.achievement.findMany({ where: { eventId } }),
    prisma.achievementUnlock.findMany({ where: { userId }, select: { achievementKey: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { displayName: true } }),
  ]);
  const have = new Set(unlocked.map((u) => u.achievementKey));
  const todo = catalog.filter((a) => !have.has(a.key));
  if (todo.length === 0) return [];

  // ── one-time state snapshot ──
  const [solves, wrongSubs, hintUnlocks, modules, inv, creds] = await Promise.all([
    prisma.solve.findMany({
      where: { userId },
      select: {
        solveIndex: true,
        timeToSolveSec: true,
        solvedAt: true,
        puzzle: { select: { moduleId: true } },
      },
    }),
    prisma.submission.findMany({
      where: { userId, isCorrect: false },
      select: { puzzle: { select: { moduleId: true } } },
    }),
    prisma.hintUnlock.findMany({
      where: { userId },
      select: { costPaid: true, hint: { select: { moduleId: true } } },
    }),
    prisma.module.findMany({
      where: { eventId, isHidden: false },
      select: { id: true, unlockRuleJson: true, puzzles: { select: { id: true } } },
    }),
    getInventoryMap(userId),
    getCreds(userId),
  ]);

  const catalogItems = await prisma.item.findMany({
    where: { eventId, type: "trophy" },
    select: { key: true },
  });

  const solvedByModule = new Map<string, number>();
  for (const s of solves)
    solvedByModule.set(
      s.puzzle.moduleId,
      (solvedByModule.get(s.puzzle.moduleId) ?? 0) + 1,
    );
  const clearedModuleIds = new Set(
    modules
      .filter((m) => m.puzzles.length > 0 && solvedByModule.get(m.id) === m.puzzles.length)
      .map((m) => m.id),
  );
  const wrongModuleIds = new Set(wrongSubs.map((s) => s.puzzle.moduleId));
  const hintedModuleIds = new Set(hintUnlocks.map((h) => h.hint.moduleId));
  const timeModuleIds = new Set(
    modules
      .filter((m) => {
        const r = parseUnlockRule(m.unlockRuleJson);
        return JSON.stringify(r).includes("windowAt") || JSON.stringify(r).includes("recurring");
      })
      .map((m) => m.id),
  );

  const trophyKeys = catalogItems.map((i) => i.key);
  const snap: AchSnapshot = {
    clearedRooms: clearedModuleIds.size,
    totalRooms: modules.length,
    noHintClears: [...clearedModuleIds].filter((id) => !hintedModuleIds.has(id)).length,
    flawlessClears: [...clearedModuleIds].filter((id) => !wrongModuleIds.has(id)).length,
    clearedTimeRooms: [...clearedModuleIds].filter((id) => timeModuleIds.has(id)).length,
    fastestSolveSec: Math.min(...solves.map((s) => s.timeToSolveSec), Infinity),
    firstBloods: solves.filter((s) => s.solveIndex === 0).length,
    credsHeld: creds,
    credsSpent:
      hintUnlocks.reduce((a, h) => a + h.costPaid, 0) + (await creditsSpentAtShop(userId)),
    holdsAllTrophies:
      trophyKeys.length > 0 && trophyKeys.every((k) => (inv[k] ?? 0) > 0),
    latestSolveMs: solves.reduce((mx, s) => Math.max(mx, s.solvedAt.getTime()), 0),
  };

  const newly: UnlockedAch[] = [];
  for (const a of todo) {
    const rule = parseJson<AchRule>(a.ruleJson, { kind: "map-runner", n: 999 } as AchRule);
    if (!evaluateAchRule(rule, snap)) continue;
    try {
      await prisma.achievementUnlock.create({
        data: { userId, achievementKey: a.key },
      });
    } catch {
      continue; // raced — already unlocked
    }
    if (a.credReward > 0) await grantItems(userId, { cred: a.credReward });
    void emitFeed(eventId, "achievement", {
      actorId: userId,
      actorName: user?.displayName ?? "",
      title: `${user?.displayName ?? "someone"} earned ${a.icon} ${a.name}`,
      meta: { key: a.key },
    });
    newly.push({ key: a.key, name: a.name, icon: a.icon, title: a.title, credReward: a.credReward });
  }
  return newly;
}

async function creditsSpentAtShop(userId: string): Promise<number> {
  const execs = await prisma.tradeExecution.findMany({
    where: { userId },
    select: { trade: { select: { giveJson: true } } },
  });
  return execs.reduce((a, e) => {
    const give = parseJson<Record<string, number>>(e.trade.giveJson, {});
    return a + (give.cred ?? 0);
  }, 0);
}

export interface AchView {
  key: string;
  name: string;
  icon: string;
  descriptionMd: string;
  title: string;
  credReward: number;
  hidden: boolean;
  unlocked: boolean;
  unlockedAt: number | null;
}

export async function getAchievements(userId: string, eventId: string): Promise<AchView[]> {
  const [catalog, unlocks] = await Promise.all([
    prisma.achievement.findMany({ where: { eventId }, orderBy: { priority: "asc" } }),
    prisma.achievementUnlock.findMany({ where: { userId } }),
  ]);
  const at = new Map(unlocks.map((u) => [u.achievementKey, u.unlockedAt.getTime()]));
  return catalog.map((a) => ({
    key: a.key,
    name: a.name,
    icon: a.icon,
    descriptionMd: a.descriptionMd,
    title: a.title,
    credReward: a.credReward,
    hidden: a.hidden,
    unlocked: at.has(a.key),
    unlockedAt: at.get(a.key) ?? null,
  }));
}

/** The title a user displays: their chosen one, else highest-priority unlocked. */
export async function titleFor(userId: string): Promise<string> {
  const [user, unlocks] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { chosenTitle: true, eventId: true } }),
    prisma.achievementUnlock.findMany({ where: { userId }, select: { achievementKey: true } }),
  ]);
  if (!user) return "";
  if (user.chosenTitle) return user.chosenTitle;
  if (unlocks.length === 0) return "";
  const earned = await prisma.achievement.findMany({
    where: { eventId: user.eventId, key: { in: unlocks.map((u) => u.achievementKey) }, title: { not: "" } },
    orderBy: { priority: "desc" },
    take: 1,
  });
  return earned[0]?.title ?? "";
}

/** Bulk version for the leaderboard. */
export async function titlesFor(eventId: string): Promise<Map<string, string>> {
  const [users, unlocks, achievements] = await Promise.all([
    prisma.user.findMany({ where: { eventId }, select: { id: true, chosenTitle: true } }),
    prisma.achievementUnlock.findMany({ select: { userId: true, achievementKey: true } }),
    prisma.achievement.findMany({ where: { eventId, title: { not: "" } }, select: { key: true, title: true, priority: true } }),
  ]);
  const byKey = new Map(achievements.map((a) => [a.key, a]));
  const best = new Map<string, { title: string; priority: number }>();
  for (const u of unlocks) {
    const a = byKey.get(u.achievementKey);
    if (!a) continue;
    const cur = best.get(u.userId);
    if (!cur || a.priority > cur.priority) best.set(u.userId, { title: a.title, priority: a.priority });
  }
  const out = new Map<string, string>();
  for (const u of users) out.set(u.id, u.chosenTitle || best.get(u.id)?.title || "");
  return out;
}
