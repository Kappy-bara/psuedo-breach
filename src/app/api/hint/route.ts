import { z } from "zod";
import { json, withUser, limitOr429, rateLimiters } from "@/lib/api";
import { prisma } from "@/lib/db";
import { parseJson } from "@/lib/json";
import { type HintUnlockRule } from "@/lib/game";
import { getInventoryMap, spendItems, InventoryError, CRED } from "@/lib/inventory";
import { checkAchievements } from "@/lib/achievements";

const Body = z.object({ hintId: z.string().min(1).max(60) });

export const POST = withUser(async (user, req) => {
  const limited = await limitOr429(rateLimiters.hint, user.id);
  if (limited) return limited;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "bad request" }, 400);

  const hint = await prisma.hint.findUnique({
    where: { id: parsed.data.hintId },
    include: { module: true },
  });
  if (!hint || hint.module.eventId !== user.eventId)
    return json({ error: "not found" }, 404);

  const existing = await prisma.hintUnlock.findUnique({
    where: { userId_hintId: { userId: user.id, hintId: hint.id } },
  });
  if (existing) return json({ unlocked: true, contentMd: hint.contentMd });

  const rule = parseJson<HintUnlockRule>(hint.unlockRule, { kind: "free" });

  if (rule.kind === "npc")
    return json({ error: "The shop has this one — go trade." }, 403);

  if (rule.kind === "item") {
    const inv = await getInventoryMap(user.id);
    if ((inv[rule.key] ?? 0) <= 0)
      return json({ error: `Locked — you need the ${rule.key}.` }, 403);
  }

  if (rule.kind === "auto-after-wrong") {
    if (!hint.puzzleId) return json({ error: "misconfigured hint" }, 500);
    const wrong = await prisma.submission.count({
      where: { userId: user.id, puzzleId: hint.puzzleId, isCorrect: false },
    });
    if (wrong < rule.n)
      return json({ error: `Unlocks after ${rule.n} wrong answers (you have ${wrong}).` }, 403);
  }

  let costPaid = 0;
  if (rule.kind === "buy") {
    try {
      await prisma.$transaction(async (tx) => {
        await spendItems(user.id, { [CRED]: rule.cost }, tx);
        await tx.hintUnlock.create({
          data: { userId: user.id, hintId: hint.id, costPaid: rule.cost },
        });
      });
      costPaid = rule.cost;
    } catch (e) {
      if (e instanceof InventoryError)
        return json({ error: `That costs ${rule.cost} 💰 and you're short.` }, 403);
      throw e;
    }
    void checkAchievements(user.id, user.eventId).catch(() => {});
    return json({ unlocked: true, contentMd: hint.contentMd, costPaid });
  }

  // free / item / auto — qualified: record and return
  await prisma.hintUnlock.create({
    data: { userId: user.id, hintId: hint.id, costPaid },
  });
  return json({ unlocked: true, contentMd: hint.contentMd });
});
