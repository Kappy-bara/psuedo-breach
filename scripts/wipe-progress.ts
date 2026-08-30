/**
 * Wipe player progress — solves, submissions, inventory, hint unlocks, trades,
 * achievement unlocks, the activity feed, and the audit log. KEEPS events, rooms,
 * puzzles, hints, items, the Shop, achievement definitions, the user accounts
 * themselves, and announcements.
 *
 * Use it to reset a leaderboard to zero (e.g. after a playtest, before go-live).
 * Runs against whatever DATABASE_URL points at.
 *
 *   npm run db:wipe                       # every event
 *   npm run db:wipe -- --event demo-session   # just one event's players
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const eventSlug = arg("event");

  let userIds: string[] | undefined;
  let eventId: string | undefined;
  if (eventSlug) {
    const ev = await prisma.event.findUnique({ where: { slug: eventSlug } });
    if (!ev) {
      console.error(`no event with slug "${eventSlug}"`);
      process.exit(1);
    }
    eventId = ev.id;
    userIds = (
      await prisma.user.findMany({ where: { eventId: ev.id }, select: { id: true } })
    ).map((u) => u.id);
  }

  const byUser = userIds ? { userId: { in: userIds } } : {};
  const byActor = userIds ? { actorId: { in: userIds } } : {};
  const byEvent = eventId ? { eventId } : {};

  const wiped = {
    submissions: (await prisma.submission.deleteMany({ where: byUser })).count,
    solves: (await prisma.solve.deleteMany({ where: byUser })).count,
    inventory: (await prisma.inventoryEntry.deleteMany({ where: byUser })).count,
    hintUnlocks: (await prisma.hintUnlock.deleteMany({ where: byUser })).count,
    tradeExecutions: (await prisma.tradeExecution.deleteMany({ where: byUser })).count,
    achievementUnlocks: (await prisma.achievementUnlock.deleteMany({ where: byUser })).count,
    feedEvents: (await prisma.feedEvent.deleteMany({ where: byEvent })).count,
    auditLogs: (await prisma.auditLog.deleteMany({ where: byActor })).count,
  };

  console.log(`wiped player progress${eventSlug ? ` for "${eventSlug}"` : ""}:`, wiped);
  console.log(
    "kept: events, rooms, puzzles, items, the Shop, achievement definitions, accounts, announcements",
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
