import { prisma } from "@/lib/db";
import { validateSubmission } from "@/lib/validators";
import { scoreSolve, SCORING } from "@/lib/scoring";
import { whichUserMintedFlag } from "@/lib/flags";
import { parseJson } from "@/lib/json";
import { eventPhase } from "@/lib/game";
import {
  type ItemMap,
  holds,
  grantItems,
  getInventoryMap,
  spendCredsFloor,
} from "@/lib/inventory";
import type { User } from "@prisma/client";

export type SubmitOutcome =
  | {
      status: "correct";
      base: number;
      bonus: number;
      solveIndex: number;
      rewards: ItemMap; // loot from the puzzle + room-clear + first blood, merged
      roomCleared: boolean;
    }
  | { status: "already-solved" }
  | { status: "wrong"; cooldownUntil: number; wrongCount: number; credsTaken: number }
  | { status: "cooldown"; cooldownUntil: number }
  | { status: "locked"; reason: string }
  | { status: "closed"; reason: string }
  | { status: "not-found" };

function mergeMaps(...maps: ItemMap[]): ItemMap {
  const out: ItemMap = {};
  for (const m of maps)
    for (const [k, v] of Object.entries(m)) out[k] = (out[k] ?? 0) + v;
  return out;
}

export async function submitAnswer(
  user: User,
  puzzleSlug: string,
  rawValue: string,
  ip: string,
): Promise<SubmitOutcome> {
  const value = (rawValue ?? "").toString().slice(0, 2000);

  const puzzle = await prisma.puzzle.findUnique({
    where: { slug: puzzleSlug },
    include: { module: { include: { event: true, puzzles: { select: { id: true } } } } },
  });
  if (!puzzle || puzzle.isHidden || puzzle.module.eventId !== user.eventId)
    return { status: "not-found" };

  const event = puzzle.module.event;
  if (eventPhase(event) !== "open")
    return {
      status: "closed",
      reason:
        eventPhase(event) === "ended"
          ? "The event has ended."
          : "The event hasn't started yet.",
    };

  const existing = await prisma.solve.findUnique({
    where: { userId_puzzleId: { userId: user.id, puzzleId: puzzle.id } },
  });
  if (existing) return { status: "already-solved" };

  const need = parseJson<ItemMap>(puzzle.module.prerequisiteItemsJson, {});
  if (Object.keys(need).length) {
    const { ok } = holds(await getInventoryMap(user.id), need);
    if (!ok) return { status: "locked", reason: "This room is locked." };
  }

  const lastWrong = await prisma.submission.findFirst({
    where: { userId: user.id, puzzleId: puzzle.id, isCorrect: false },
    orderBy: { createdAt: "desc" },
  });
  if (lastWrong) {
    const until = lastWrong.createdAt.getTime() + puzzle.cooldownSec * 1000;
    if (until > Date.now()) return { status: "cooldown", cooldownUntil: until };
  }

  const correct = validateSubmission({
    type: puzzle.type,
    validatorConfig: puzzle.validatorConfig,
    perUserFlag: puzzle.perUserFlag,
    puzzleSlug: puzzle.slug,
    userId: user.id,
    submitted: value,
  });

  await prisma.submission.create({
    data: { userId: user.id, puzzleId: puzzle.id, value, isCorrect: correct, ip },
  });

  if (!correct) {
    if (puzzle.perUserFlag && /^CMINUS\{[A-Z2-7]{16}\}$/.test(value.trim())) {
      const others = await prisma.user.findMany({
        where: { eventId: user.eventId, id: { not: user.id } },
        select: { id: true },
      });
      const owner = whichUserMintedFlag(value.trim(), puzzle.slug, others);
      if (owner) {
        await prisma.auditLog.create({
          data: {
            action: "flag-owner-mismatch",
            actorId: user.id,
            targetType: "puzzle",
            targetId: puzzle.id,
            meta: JSON.stringify({
              submittedBy: user.id,
              mintedFor: owner,
              puzzle: puzzle.slug,
            }),
          },
        });
      }
    }

    const cfg = parseJson<{ wrongCostCreds?: number }>(puzzle.validatorConfig, {});
    const credsTaken = cfg.wrongCostCreds
      ? await spendCredsFloor(user.id, cfg.wrongCostCreds)
      : 0;

    const wrongCount = await prisma.submission.count({
      where: { userId: user.id, puzzleId: puzzle.id, isCorrect: false },
    });
    return {
      status: "wrong",
      cooldownUntil: Date.now() + puzzle.cooldownSec * 1000,
      wrongCount,
      credsTaken,
    };
  }

  // correct — score it
  const solveIndex = await prisma.solve.count({ where: { puzzleId: puzzle.id } });
  const openedAt = puzzle.module.unlockAt ?? event.startsAt;
  const elapsedSec = Math.max(0, Math.floor((Date.now() - openedAt.getTime()) / 1000));
  const s = scoreSolve(puzzle.basePoints, solveIndex, elapsedSec);

  await prisma.solve.create({
    data: {
      userId: user.id,
      puzzleId: puzzle.id,
      basePts: s.base,
      bonusPts: s.bonus,
      solveIndex,
      timeToSolveSec: elapsedSec,
    },
  });

  // loot: puzzle rewards + first-blood creds + (room clear reward if this finishes it)
  const puzzleRewards = parseJson<ItemMap>(puzzle.rewardsJson, {});
  const firstBlood: ItemMap =
    solveIndex === 0 ? { cred: SCORING.FIRST_BLOOD_CREDS } : {};

  const solvedIds = new Set(
    (
      await prisma.solve.findMany({
        where: {
          userId: user.id,
          puzzleId: { in: puzzle.module.puzzles.map((p) => p.id) },
        },
        select: { puzzleId: true },
      })
    ).map((r) => r.puzzleId),
  );
  const roomCleared = puzzle.module.puzzles.every((p) => solvedIds.has(p.id));
  const clearReward = roomCleared
    ? parseJson<ItemMap>(puzzle.module.clearRewardJson, {})
    : {};

  const rewards = mergeMaps(puzzleRewards, firstBlood, clearReward);
  if (Object.keys(rewards).length) await grantItems(user.id, rewards);

  return {
    status: "correct",
    base: s.base,
    bonus: s.bonus,
    solveIndex,
    rewards,
    roomCleared,
  };
}
