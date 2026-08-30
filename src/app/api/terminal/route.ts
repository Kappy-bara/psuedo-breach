import { z } from "zod";
import { json, withUser, limitOr429, rateLimiters } from "@/lib/api";
import { prisma } from "@/lib/db";
import { parseJson } from "@/lib/json";
import {
  eventPhase,
  grantToken,
  userTokenKeys,
  userFlag,
  type HintUnlockRule,
} from "@/lib/game";
import { runProbe } from "@/content/probes";

const Body = z.object({
  op: z.enum(["probe", "knock", "stash", "recall", "hint"]),
  args: z.array(z.string().max(400)).max(4).default([]),
});

async function moduleForUser(userId: string, eventId: string, slug: string) {
  const m = await prisma.module.findUnique({
    where: { eventId_slug: { eventId, slug } },
  });
  if (!m || m.isHidden) return null;
  return m;
}

async function moduleLocked(
  m: { prerequisiteTokenKeys: string; unlockAt: Date | null },
  userId: string,
): Promise<string | null> {
  const prereqs = parseJson<string[]>(m.prerequisiteTokenKeys, []);
  if (prereqs.length) {
    const tokens = await userTokenKeys(userId);
    const missing = prereqs.filter((k) => !tokens.has(k));
    if (missing.length) return `denied — needs: ${missing.join(", ")}`;
  }
  if (m.unlockAt && new Date() < m.unlockAt) return "denied — not open yet";
  return null;
}

export const POST = withUser(async (user, req) => {
  const limited = await limitOr429(rateLimiters.terminal, user.id);
  if (limited) return limited;

  const event = await prisma.event.findUnique({ where: { id: user.eventId } });
  if (!event || eventPhase(event) !== "open")
    return json({ error: "the event is not open" }, 403);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "bad request" }, 400);
  const { op, args } = parsed.data;

  /* ── probe ── */
  if (op === "probe") {
    const slug = args[0] ?? "";
    const m = await moduleForUser(user.id, user.eventId, slug);
    if (!m) return json({ result: `probe: unknown module "${slug}"` });
    const lock = await moduleLocked(m, user.id);
    if (lock) return json({ result: `probe ${slug}: ${lock}` });
    const out = runProbe(slug, user.id);
    return json({ result: out ?? `probe ${slug}: nothing responds` });
  }

  /* ── knock ── */
  if (op === "knock") {
    const slug = args[0] ?? "";
    const key = args[1] ?? "";
    const m = await moduleForUser(user.id, user.eventId, slug);
    if (!m) return json({ result: `knock: unknown module "${slug}"` });

    const hints = await prisma.hint.findMany({ where: { moduleId: m.id } });
    const tokens = await userTokenKeys(user.id);
    for (const h of hints) {
      const rule = parseJson<HintUnlockRule>(h.unlockRule, { kind: "free" });
      if (rule.kind !== "terminal" || rule.knockKey !== key) continue;
      const need = rule.requireTokens ?? [];
      const missing = need.filter((k) => !tokens.has(k));
      if (missing.length) return json({ result: `knock ${slug}: denied — missing ${missing.join(", ")}` });

      await prisma.hintUnlock.upsert({
        where: { userId_hintId: { userId: user.id, hintId: h.id } },
        update: {},
        create: { userId: user.id, hintId: h.id, costPaid: 0 },
      });
      if (h.grantsTokenKey) await grantToken(user.id, h.grantsTokenKey);

      let reveal = "";
      if (rule.revealFlagFor) {
        reveal = `\nflag: ${userFlag(user.id, rule.revealFlagFor)}`;
      }
      return json({ result: `knock ${slug}: ACCEPTED\n${h.contentMd}${reveal}` });
    }
    return json({ result: `knock ${slug}: denied` });
  }

  /* ── stash / recall ── */
  if (op === "stash") {
    const key = (args[0] ?? "").slice(0, 120);
    const value = (args[1] ?? "").slice(0, 400);
    if (!key) return json({ result: "stash: need a key" });
    await prisma.playerKV.upsert({
      where: { userId_key: { userId: user.id, key } },
      update: { value },
      create: { userId: user.id, key, value },
    });
    return json({ result: `stashed "${key}"` });
  }
  if (op === "recall") {
    const key = (args[0] ?? "").slice(0, 120);
    const kv = await prisma.playerKV.findUnique({
      where: { userId_key: { userId: user.id, key } },
    });
    return json({ result: kv ? kv.value : null });
  }

  /* ── hint ── */
  if (op === "hint") {
    const slug = args[0] ?? "";
    if (!slug)
      return json({
        result: "usage: hint(\"module-slug\"). lists what that module can tell you.",
      });
    const m = await moduleForUser(user.id, user.eventId, slug);
    if (!m) return json({ result: `hint: unknown module "${slug}"` });
    const hints = await prisma.hint.findMany({
      where: { moduleId: m.id },
      orderBy: { order: "asc" },
    });
    const unlocks = await prisma.hintUnlock.findMany({
      where: { userId: user.id, hintId: { in: hints.map((h) => h.id) } },
    });
    const unlockedIds = new Set(unlocks.map((u) => u.hintId));
    const tokens = await userTokenKeys(user.id);
    const lines: string[] = [];
    for (let i = 0; i < hints.length; i++) {
      const h = hints[i]!;
      const rule = parseJson<HintUnlockRule>(h.unlockRule, { kind: "free" });
      let visible = unlockedIds.has(h.id);
      if (!visible && rule.kind === "free") visible = true;
      if (!visible && rule.kind === "token" && tokens.has(rule.key)) visible = true;
      if (!visible && rule.kind === "auto-after-wrong" && h.puzzleId) {
        const wrong = await prisma.submission.count({
          where: { userId: user.id, puzzleId: h.puzzleId, isCorrect: false },
        });
        if (wrong >= rule.n) visible = true;
      }
      lines.push(visible ? `[${i + 1}] ${h.contentMd}` : `[${i + 1}] (locked: ${rule.kind})`);
    }
    return json({ result: lines.join("\n") || "no hints here" });
  }

  return json({ error: "unknown op" }, 400);
});
