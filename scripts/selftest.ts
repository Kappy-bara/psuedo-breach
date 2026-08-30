/**
 * End-to-end sanity check for the MAIN dungeon: a throwaway operator crawls every
 * room in dependency order, forges keycards at SUDO, opens THE CORE, and we assert
 * every gate, every loot drop, the cred math, and the anti-share audit trail.
 * Cleans up after itself.
 *
 *   npm run selftest
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { submitAnswer } from "../src/lib/submit";
import { executeTrade } from "../src/lib/trade";
import { userFlag } from "../src/lib/flags";
import { getInventoryMap, getCreds } from "../src/lib/inventory";
import { getModuleCards } from "../src/lib/game";

const prisma = new PrismaClient();
const REG = "PB-SELFTEST-XX";

let pass = 0;
let fail = 0;
function check(label: string, ok: boolean, extra = "") {
  console.log(`${ok ? "  ok  " : " FAIL "} ${label}${extra ? ` — ${extra}` : ""}`);
  ok ? pass++ : fail++;
}

async function tradeIdByLabel(eventId: string, needle: string) {
  const npc = await prisma.npc.findUniqueOrThrow({
    where: { eventId_slug: { eventId, slug: "sudo" } },
    include: { trades: true },
  });
  return npc.trades.find((t) => t.label.includes(needle))!.id;
}

async function main() {
  const event = await prisma.event.findUniqueOrThrow({ where: { slug: "pseudo-breach-main" } });
  const originalStatus = event.status;

  await prisma.user.deleteMany({ where: { registerId: { startsWith: REG } } });
  const user = await prisma.user.create({
    data: {
      registerId: REG,
      displayName: "Selftest",
      role: "participant",
      eventId: event.id,
      passwordHash: await bcrypt.hash("x", 4),
    },
  });
  await prisma.event.update({ where: { id: event.id }, data: { status: "live" } });

  try {
    const flag = (slug: string) => userFlag(user.id, slug);

    // gating: fresh user can't touch a keycard room
    const blocked = await submitAnswer(user, "closet-diff", "CMINUS{D1FF_TH3_C0NF1G}", "127.0.0.1");
    check("server-closet locked without blue keycard", blocked.status === "locked", blocked.status);

    const steps: [string, string][] = [
      ["lobby-flag", "CMINUS{L00K_B3F0R3_Y0U_L3AP}"],
      ["reception-caesar", flag("reception-caesar")],
      ["mailroom-inbox", "CMINUS{R34D_TH3_H34D3RS}"],
      ["closet-diff", "CMINUS{D1FF_TH3_C0NF1G}"],
    ];
    for (const [slug, val] of steps) {
      const o = await submitAnswer(user, slug, val, "127.0.0.1");
      check(`crack ${slug}`, o.status === "correct", o.status !== "correct" ? JSON.stringify(o) : "");
    }

    let inv = await getInventoryMap(user.id);
    check("3 alpha shards collected", (inv["frag-alpha"] ?? 0) === 3, `have ${inv["frag-alpha"] ?? 0}`);
    check("blue keycard from reception", (inv["keycard-blue"] ?? 0) === 1);
    check("corroded badge from closet", (inv["loot-old-badge"] ?? 0) === 1);

    const forgeRed = await executeTrade(user.id, event.id, await tradeIdByLabel(event.id, "Red Keycard"));
    check("forge red keycard", forgeRed.status === "ok", forgeRed.status);
    inv = await getInventoryMap(user.id);
    check("3 alpha shards consumed by forge", (inv["frag-alpha"] ?? 0) === 0);
    check("hold red keycard", (inv["keycard-red"] ?? 0) === 1);

    for (const [slug, val] of [
      ["security-cctv", "CMINUS{IT_WAS_MORGAN}"],
      ["honeypot-real", "CMINUS{N0T_3V3RY_FL4G_1S_R34L}"],
      ["tunnels-trail", "CMINUS{TH3_TUNN3LS_C0NN3CT}"],
    ] as [string, string][]) {
      const o = await submitAnswer(user, slug, val, "127.0.0.1");
      check(`crack ${slug}`, o.status === "correct", o.status !== "correct" ? JSON.stringify(o) : "");
    }

    inv = await getInventoryMap(user.id);
    check("3 beta shards collected", (inv["frag-beta"] ?? 0) === 3, `have ${inv["frag-beta"] ?? 0}`);
    check("green keycard from security", (inv["keycard-green"] ?? 0) === 1);
    check("sweet tooth trophy from honeypot", (inv["trophy-sweettooth"] ?? 0) === 1);

    const forgeBlack = await executeTrade(user.id, event.id, await tradeIdByLabel(event.id, "Black Keycard"));
    check("forge black keycard", forgeBlack.status === "ok", forgeBlack.status);

    const openCore = await executeTrade(user.id, event.id, await tradeIdByLabel(event.id, "Open THE CORE"));
    check("open THE CORE (3 keycards → master)", openCore.status === "ok", openCore.status);
    inv = await getInventoryMap(user.id);
    check("red/green/black consumed", !inv["keycard-red"] && !inv["keycard-green"] && !inv["keycard-black"]);
    check("hold master keycard", (inv["keycard-master"] ?? 0) === 1);

    const core = await submitAnswer(user, "core-final", flag("core-final"), "127.0.0.1");
    check("crack THE CORE", core.status === "correct", core.status);
    inv = await getInventoryMap(user.id);
    check("root trophy", (inv["trophy-root"] ?? 0) === 1);

    const cards = await getModuleCards(user);
    check("every room unlocked", cards.every((c) => !c.locked), cards.filter((c) => c.locked).map((c) => c.slug).join(","));
    check("every room cleared", cards.every((c) => c.cleared));

    const creds = await getCreds(user.id);
    check("cred wallet is positive and sane", creds > 200 && creds < 2000, `${creds}`);

    // anti-share: stolen per-user flag
    const fresh = await prisma.user.create({
      data: { registerId: REG + "-2", displayName: "Selftest2", eventId: event.id, passwordHash: await bcrypt.hash("x", 4) },
    });
    const stolen = await submitAnswer(fresh, "reception-caesar", userFlag(user.id, "reception-caesar"), "127.0.0.1");
    check("cross-user flag rejected", stolen.status === "wrong", stolen.status);
    const log = await prisma.auditLog.findFirst({ where: { action: "flag-owner-mismatch", actorId: fresh.id } });
    check("flag-sharing logged", log !== null);

    // honeypot toll actually charges
    const fresh2creds0 = await getCreds(fresh.id);
    await prisma.inventoryEntry.upsert({
      where: { userId_itemKey: { userId: fresh.id, itemKey: "cred" } },
      update: { quantity: 20 },
      create: { userId: fresh.id, itemKey: "cred", quantity: 20 },
    });
    const wrongHoney = await submitAnswer(fresh, "honeypot-real", "CMINUS{wrong}", "127.0.0.1");
    check(
      "honeypot toll charged 5 creds",
      wrongHoney.status === "wrong" && wrongHoney.credsTaken === 5,
      JSON.stringify(wrongHoney),
    );
    void fresh2creds0;
  } finally {
    await prisma.user.deleteMany({ where: { registerId: { startsWith: REG } } });
    await prisma.event.update({ where: { id: event.id }, data: { status: originalStatus } });
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
