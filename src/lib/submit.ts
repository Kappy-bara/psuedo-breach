import { prisma } from "@/lib/db";
import { validateSubmission } from "@/lib/validators";
import { scoreSolve } from "@/lib/scoring";
import { whichUserMintedFlag } from "@/lib/flags";
import { parseJson } from "@/lib/json";
import { eventPhase, grantToken, userTokenKeys } from "@/lib/game";
import type { User } from "@prisma/client";

export type SubmitOutcome =
  | { status: "correct"; base: number; bonus: number; solveIndex: number; tokenGranted: string | null }
  | { status: "already-solved" }
  | { status: "wrong"; cooldownUntil: number; wrongCount: number }
  | { status: "cooldown"; cooldownUntil: number }
  | { status: "locked"; reason: string }
  | { status: "closed"; reason: string }
  | { status: "not-found" };

export async function submitAnswer(
  user: User,
  puzzleSlug: string,
  rawValue: string,
  ip: string,
): Promise<SubmitOutcome> {
  const value = (rawValue ?? "").toString().slice(0, 2000);

  const puzzle = await prisma.puzzle.findUnique({
    where: { slug: puzzleSlug },
    include: { module: { include: { event: true } } },
  });
  if (!puzzle || puzzle.isHidden || puzzle.module.eventId !== user.eventId)
    return { status: "not-found" };

  const event = puzzle.module.event;
  if (eventPhase(event) !== "open")
    return {
      status: "closed",
      reason: eventPhase(event) === "ended" ? "The event has ended." : "The event hasn't started yet.",
    };

  // module prerequisite tokens
  const prereqs = parseJson<string[]>(puzzle.module.prerequisiteTokenKeys, []);
  if (prereqs.length) {
    const tokens = await userTokenKeys(user.id);
    const missing = prereqs.filter((k) => !tokens.has(k));
    if (missing.length) return { status: "locked", reason: `Locked — needs: ${missing.join(", ")}` };
  }

  const existing = await prisma.solve.findUnique({
    where: { userId_puzzleId: { userId: user.id, puzzleId: puzzle.id } },
  });
  if (existing) return { status: "already-solved" };

  // cooldown from the most recent wrong answer
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
    // sharing detection: was this a *valid* per-user flag minted for someone else?
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
            meta: JSON.stringify({ submittedBy: user.id, mintedFor: owner, puzzle: puzzle.slug }),
          },
        });
      }
    }
    const wrongCount = await prisma.submission.count({
      where: { userId: user.id, puzzleId: puzzle.id, isCorrect: false },
    });
    return {
      status: "wrong",
      cooldownUntil: Date.now() + puzzle.cooldownSec * 1000,
      wrongCount,
    };
  }

  // correct — compute score
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

  let tokenGranted: string | null = null;
  if (puzzle.grantsTokenKey) {
    await grantToken(user.id, puzzle.grantsTokenKey, puzzle.id);
    tokenGranted = puzzle.grantsTokenKey;
  }

  return {
    status: "correct",
    base: s.base,
    bonus: s.bonus,
    solveIndex,
    tokenGranted,
  };
}
