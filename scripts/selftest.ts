/**
 * End-to-end sanity check for the MAIN event: a throwaway operator solves every
 * puzzle in dependency order and we assert tokens grant, gated modules open, and
 * the vault pays out. Cleans up after itself.
 *
 *   npm run selftest
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { submitAnswer } from "../src/lib/submit";
import { userFlag } from "../src/lib/flags";
import { getModuleCards } from "../src/lib/game";

const prisma = new PrismaClient();
const REG = "PB-SELFTEST-XX";

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");
const fizzbuzz = Array.from({ length: 20 }, (_, i) => {
  const n = i + 1;
  if (n % 15 === 0) return "fizzbuzz";
  if (n % 3 === 0) return "fizz";
  if (n % 5 === 0) return "buzz";
  return String(n);
}).join("\n");

let pass = 0;
let fail = 0;
function check(label: string, ok: boolean, extra = "") {
  console.log(`${ok ? "  ok  " : " FAIL "} ${label}${extra ? ` — ${extra}` : ""}`);
  ok ? pass++ : fail++;
}

async function main() {
  const event = await prisma.event.findUniqueOrThrow({
    where: { slug: "pseudo-breach-main" },
  });
  const originalStatus = event.status;

  await prisma.user.deleteMany({ where: { registerId: REG } });
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
    const answer = (slug: string) => userFlag(user.id, slug);
    const steps: [string, string, string][] = [
      ["orientation", "recon-headers", "CMINUS{V13W_S0URC3_FTW}"],
      ["front-door", "forge-token", `CMINUS{${b64('{"user":"guest","admin":true}')}}`],
      ["caesars-ghost", "ghost-chain", answer("ghost-chain")],
      ["boot-camp", "fizzbuzz", fizzbuzz],
      ["boot-camp", "xor-decode", answer("xor-decode")],
      ["dom-dimension", "hidden-state", "CMINUS{D0M_1S_N0T_S3CUR1TY}"],
      ["signal-noise", "stego-lines", answer("stego-lines")],
      ["compilers-curse", "read-the-program", answer("read-the-program")],
      ["the-vault", "assemble-master", answer("assemble-master")],
    ];

    for (const [mod, slug, value] of steps) {
      const out = await submitAnswer(user, slug, value, "127.0.0.1");
      check(
        `solve ${mod}/${slug}`,
        out.status === "correct",
        out.status !== "correct" ? JSON.stringify(out) : `+${(out as { base: number }).base}`,
      );
    }

    const tokens = new Set(
      (await prisma.tokenGrant.findMany({ where: { userId: user.id } })).map((t) => t.key),
    );
    check("token ghost-key granted", tokens.has("ghost-key"));
    check("token compiler-pass granted", tokens.has("compiler-pass"));
    check("token siren-key granted", tokens.has("siren-key"));

    const cards = await getModuleCards(user);
    check(
      "all modules unlocked after tokens",
      cards.every((c) => !c.locked),
      cards.filter((c) => c.locked).map((c) => c.slug).join(","),
    );
    check(
      "all modules cleared",
      cards.every((c) => c.puzzleCount > 0 && c.solvedCount === c.puzzleCount),
    );

    // gating actually blocks: fresh user can't touch signal-noise
    const fresh = await prisma.user.create({
      data: {
        registerId: REG + "-2",
        displayName: "Selftest2",
        eventId: event.id,
        passwordHash: await bcrypt.hash("x", 4),
      },
    });
    const blocked = await submitAnswer(fresh, "stego-lines", userFlag(fresh.id, "stego-lines"), "127.0.0.1");
    check("signal-noise blocked without ghost-key", blocked.status === "locked", blocked.status);
    const stolen = await submitAnswer(fresh, "ghost-chain", userFlag(user.id, "ghost-chain"), "127.0.0.1");
    check("cross-user flag rejected", stolen.status === "wrong", stolen.status);
    const shareLog = await prisma.auditLog.findFirst({
      where: { action: "flag-owner-mismatch", actorId: fresh.id },
    });
    check("flag-sharing logged to audit", shareLog !== null);
    await prisma.user.delete({ where: { id: fresh.id } });
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
