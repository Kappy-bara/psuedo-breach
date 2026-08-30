/**
 * End-to-end check for the v3 MAIN event: open-world unlock rules, the feed,
 * medals, achievements, the year board. A throwaway operator plays through;
 * cleans up after itself.
 *
 *   npm run selftest
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { submitAnswer } from "../src/lib/submit";
import { executeTrade } from "../src/lib/trade";
import { userFlag } from "../src/lib/flags";
import { getInventoryMap } from "../src/lib/inventory";
import { getModuleCards, getYearBoard } from "../src/lib/game";

const prisma = new PrismaClient();
const REG = "PB-SELFTEST-XX";

let pass = 0;
let fail = 0;
function check(label: string, ok: boolean, extra = "") {
  console.log(`${ok ? "  ok  " : " FAIL "} ${label}${extra ? ` — ${extra}` : ""}`);
  if (ok) pass++;
  else fail++;
}

/** Poll a predicate for up to ~2s — the feed / achievement writes are fire-and-forget. */
async function waitFor(fn: () => Promise<boolean>, tries = 20, gapMs = 100): Promise<boolean> {
  for (let i = 0; i < tries; i++) {
    if (await fn()) return true;
    await new Promise((r) => setTimeout(r, gapMs));
  }
  return false;
}

async function tradeIdByLabel(eventId: string, needle: string) {
  const npc = await prisma.npc.findUniqueOrThrow({
    where: { eventId_slug: { eventId, slug: "shop" } },
    include: { trades: true },
  });
  return npc.trades.find((t) => t.label.includes(needle))!.id;
}
async function main() {
  const event = await prisma.event.findUniqueOrThrow({ where: { slug: "pseudo-breach-main" } });
  const original = { status: event.status, startsAt: event.startsAt, endsAt: event.endsAt };

  await prisma.user.deleteMany({ where: { registerId: { startsWith: REG } } });
  const user = await prisma.user.create({
    data: {
      registerId: REG,
      displayName: "Selftest",
      role: "participant",
      year: "2",
      eventId: event.id,
      passwordHash: await bcrypt.hash("x", 4),
    },
  });
  // event live, starting now (so windows/recurring anchor to now)
  await prisma.event.update({
    where: { id: event.id },
    data: { status: "live", startsAt: new Date(), endsAt: new Date(Date.now() + 6 * 3600_000) },
  });

  const card = async (slug: string) => {
    const cards = await getModuleCards(user);
    return cards.find((c) => c.slug === slug)!;
  };

  try {
    const flag = (slug: string) => userFlag(user.id, slug);

    // ── unlock: 4 rooms open, item rooms locked ──
    for (const s of ["lobby", "reception", "mailroom", "honeypot"]) {
      check(`${s} open at start`, !(await card(s)).locked);
    }
    check("server-closet locked (needs blue)", (await card("server-closet")).locked);
    const blocked = await submitAnswer(user, "closet-diff", "CMINUS{D1FF_TH3_C0NF1G}", "127.0.0.1");
    check("submit blocked on locked room", blocked.status === "locked", blocked.status);

    // ── clear the 4 entry rooms ──
    const steps: [string, string][] = [
      ["lobby-flag", "CMINUS{L00K_B3F0R3_Y0U_L3AP}"],
      ["reception-caesar", flag("reception-caesar")],
      ["mailroom-inbox", "CMINUS{R34D_TH3_H34D3RS}"],
      ["honeypot-real", "CMINUS{N0T_3V3RY_FL4G_1S_R34L}"],
    ];
    for (const [slug, val] of steps) {
      const o = await submitAnswer(user, slug, val, "127.0.0.1");
      check(`crack ${slug}`, o.status === "correct", o.status !== "correct" ? JSON.stringify(o) : `medal=${(o as { medal: string }).medal}`);
    }

    // ── first-blood + medal + feed ──
    check(
      "first-blood emitted to feed",
      await waitFor(async () => (await prisma.feedEvent.count({ where: { eventId: event.id, kind: "first-blood" } })) >= 1),
    );
    const solved0 = await prisma.solve.findFirst({ where: { userId: user.id, puzzle: { slug: "lobby-flag" } } });
    check("solo tester is gold (solveIndex 0)", solved0?.solveIndex === 0);

    // ── achievements: first-steps, punctual (via a time room later) ──
    check(
      "first-steps achievement unlocked",
      await waitFor(
        async () =>
          (await prisma.achievementUnlock.findFirst({
            where: { userId: user.id, achievementKey: "first-steps" },
          })) !== null,
      ),
    );
    const ach = await prisma.achievement.findUniqueOrThrow({ where: { eventId_key: { eventId: event.id, key: "first-steps" } } });
    check("achievement granted its cred reward", (await getInventoryMap(user.id)).cred! >= ach.credReward);

    // ── forge a keycard, open a gated room ──
    // reception gave keycard-blue → server-closet should now be open
    check("server-closet unlocked after blue keycard", !(await card("server-closet")).locked);
    const closet = await submitAnswer(user, "closet-diff", "CMINUS{D1FF_TH3_C0NF1G}", "127.0.0.1");
    check("crack server-closet", closet.status === "correct", closet.status);

    const inv = await getInventoryMap(user.id);
    check("3 alpha shards for a forge", (inv["frag-alpha"] ?? 0) >= 3, `have ${inv["frag-alpha"] ?? 0}`);
    const forge = await executeTrade(user.id, event.id, await tradeIdByLabel(event.id, "Red Keycard"));
    check("forge red keycard", forge.status === "ok", forge.status);
    check(
      "forge emitted to feed",
      await waitFor(async () => (await prisma.feedEvent.count({ where: { eventId: event.id, kind: "forge" } })) >= 1),
    );
    check("security unlocked after red keycard", !(await card("security")).locked);

    // ── recurring time room: open right now (anchored to event start = now) ──
    const drop = await card("supply-drop");
    check("supply-drop is open (recurring window active at t=0)", !drop.locked, drop.lockedReason ?? "");
    const dropSolve = await submitAnswer(user, "drop-grab", "CMINUS{5UPPLY_5N4TCH3D}", "127.0.0.1");
    check("crack supply-drop", dropSolve.status === "correct", dropSolve.status);
    check(
      "punctual achievement (cleared a time room)",
      await waitFor(
        async () =>
          (await prisma.achievementUnlock.findFirst({
            where: { userId: user.id, achievementKey: "punctual" },
          })) !== null,
      ),
    );

    // ── one-shot window: lock it, then set it live, then solve ──
    const booth1 = await card("broadcast-booth");
    check("broadcast-booth locked (window in the future)", booth1.locked && booth1.unlockKind === "time");
    await prisma.module.update({
      where: { eventId_slug: { eventId: event.id, slug: "broadcast-booth" } },
      data: {
        unlockRuleJson: JSON.stringify({
          windowAt: { from: new Date(Date.now() - 60_000).toISOString(), to: new Date(Date.now() + 300_000).toISOString() },
        }),
      },
    });
    check("broadcast-booth open once its window is now", !(await card("broadcast-booth")).locked);
    const booth = await submitAnswer(user, "booth-morse", "cminus{l1v3_0n_41r}", "127.0.0.1");
    check("crack broadcast-booth", booth.status === "correct", booth.status);

    // ── year board ──
    const yb = await getYearBoard(event.id);
    const y2 = yb.find((r) => r.year === "2");
    check("year board sums our year", (y2?.totalScore ?? 0) > 0, JSON.stringify(y2));

    // ── anti-share still works ──
    const fresh = await prisma.user.create({
      data: { registerId: REG + "-2", displayName: "Selftest2", eventId: event.id, passwordHash: await bcrypt.hash("x", 4) },
    });
    const stolen = await submitAnswer(fresh, "reception-caesar", userFlag(user.id, "reception-caesar"), "127.0.0.1");
    check("cross-user flag rejected", stolen.status === "wrong", stolen.status);
    check(
      "flag-sharing logged",
      (await prisma.auditLog.findFirst({ where: { action: "flag-owner-mismatch", actorId: fresh.id } })) !== null,
    );
  } finally {
    await prisma.user.deleteMany({ where: { registerId: { startsWith: REG } } });
    await prisma.event.update({ where: { id: event.id }, data: original });
    // restore the broadcast-booth default window (re-seed value)
    await prisma.module.update({
      where: { eventId_slug: { eventId: event.id, slug: "broadcast-booth" } },
      data: {
        unlockRuleJson: JSON.stringify({
          windowAt: { from: "2026-09-16T15:00:00.000Z", to: "2026-09-16T15:30:00.000Z" },
        }),
      },
    });
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
