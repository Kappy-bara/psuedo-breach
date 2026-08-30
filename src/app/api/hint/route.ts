import { z } from "zod";
import { json, withUser, limitOr429, rateLimiters } from "@/lib/api";
import { prisma } from "@/lib/db";
import { parseJson } from "@/lib/json";
import { getUserScore, grantToken, userTokenKeys, type HintUnlockRule } from "@/lib/game";

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
  if (existing)
    return json({ unlocked: true, contentMd: hint.contentMd, grantsTokenKey: hint.grantsTokenKey });

  const rule = parseJson<HintUnlockRule>(hint.unlockRule, { kind: "free" });
  let costPaid = 0;

  if (rule.kind === "terminal") {
    return json({ error: "This hint is reached from the terminal (knock)." }, 403);
  }
  if (rule.kind === "token") {
    const tokens = await userTokenKeys(user.id);
    if (!tokens.has(rule.key))
      return json({ error: `Locked — needs the "${rule.key}" token.` }, 403);
  }
  if (rule.kind === "auto-after-wrong") {
    if (!hint.puzzleId) return json({ error: "misconfigured hint" }, 500);
    const wrong = await prisma.submission.count({
      where: { userId: user.id, puzzleId: hint.puzzleId, isCorrect: false },
    });
    if (wrong < rule.n)
      return json({ error: `Unlocks after ${rule.n} wrong answers (you have ${wrong}).` }, 403);
  }
  if (rule.kind === "paid") {
    costPaid = hint.cost;
    const score = await getUserScore(user.id);
    if (score < costPaid)
      return json({ error: `Costs ${costPaid} points — you have ${score}.` }, 403);
  }

  await prisma.hintUnlock.create({
    data: { userId: user.id, hintId: hint.id, costPaid },
  });
  if (hint.grantsTokenKey) await grantToken(user.id, hint.grantsTokenKey);

  return json({
    unlocked: true,
    contentMd: hint.contentMd,
    grantsTokenKey: hint.grantsTokenKey,
    costPaid,
  });
});
