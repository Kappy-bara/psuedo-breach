import Link from "next/link";
import { requireUser } from "@/lib/session";
import {
  getModuleCards,
  getAnnouncements,
  getItemCatalog,
  getUserScore,
  eventPhase,
} from "@/lib/game";
import { getInventory, getCreds, CRED } from "@/lib/inventory";
import { getFeed } from "@/lib/feed";
import { getAchievements } from "@/lib/achievements";
import { prisma } from "@/lib/db";
import { RoomsView } from "@/components/RoomsView";
import { ActivityFeed } from "@/components/ActivityFeed";
import { ItemChip } from "@/components/ItemChip";
import { Markdown } from "@/components/Markdown";

export default async function Dashboard() {
  const user = await requireUser();
  const event = await prisma.event.findUnique({ where: { id: user.eventId } });
  const [cards, announcements, inv, creds, score, catalog, feed, achievements] =
    await Promise.all([
      getModuleCards(user),
      getAnnouncements(user.eventId),
      getInventory(user.id),
      getCreds(user.id),
      getUserScore(user.id),
      getItemCatalog(user.eventId),
      getFeed(user.eventId, 8),
      getAchievements(user.id, user.eventId),
    ]);

  const phase = event ? eventPhase(event) : "before";
  const cleared = cards.filter((c) => c.cleared).length;
  const carried = inv.filter((e) => e.itemKey !== CRED);
  const medalCount = cards.filter((c) => c.yourMedal).length;
  const achGot = achievements.filter((a) => a.unlocked).length;
  const phaseTag =
    phase === "open"
      ? { t: "LIVE", c: "text-verified" }
      : phase === "ended"
        ? { t: "ENDED", c: "text-danger" }
        : { t: "NOT STARTED", c: "text-signal" };

  return (
    <div className="space-y-7">
      {/* HUD */}
      <section className="grid gap-3 md:grid-cols-[1.5fr_1fr]">
        <div className="panel p-5">
          <div className="flex items-baseline justify-between">
            <div className="kicker">operator</div>
            <span className={`text-xs ${phaseTag.c}`}>● {phaseTag.t}</span>
          </div>
          <div className="mt-1 font-display text-xl font-bold">{user.displayName}</div>
          <div className="mt-0.5 text-sm text-ink-dim">
            {user.registerId}
            {user.branch && ` · ${user.branch}`}
            {user.year && ` · year ${user.year}`}
          </div>
          <div className="mt-4 grid grid-cols-4 gap-3">
            <div className="instrument">
              <span className="lbl">pts</span>
              <span className="val">{score}</span>
            </div>
            <div className="instrument">
              <span className="lbl">creds</span>
              <span className="val text-signal">{creds}</span>
            </div>
            <div className="instrument">
              <span className="lbl">rooms</span>
              <span className="val">
                {cleared}
                <span className="text-sm text-ink-faint">/{cards.length}</span>
              </span>
            </div>
            <div className="instrument">
              <span className="lbl">medals</span>
              <span className="val">{medalCount}</span>
            </div>
          </div>
        </div>

        <div className="panel flex flex-col p-5">
          <div className="flex items-center justify-between">
            <div className="kicker">satchel</div>
            <Link href="/inventory" className="text-xs text-ink-dim hover:text-ink">
              open →
            </Link>
          </div>
          <div className="mt-2 flex flex-1 flex-wrap content-start gap-1">
            {carried.length === 0 ? (
              <span className="text-xs text-ink-faint">no loot yet</span>
            ) : (
              carried
                .slice(0, 9)
                .map((e) => (
                  <ItemChip
                    key={e.itemKey}
                    item={catalog.get(e.itemKey)}
                    qty={e.quantity}
                    fallbackKey={e.itemKey}
                  />
                ))
            )}
          </div>
          <Link
            href="/achievements"
            className="mt-3 border-t border-border pt-2 text-xs text-ink-dim hover:text-ink"
          >
            🎖️ {achGot}/{achievements.length} achievements →
          </Link>
        </div>
      </section>

      {feed.length > 0 && (
        <div className="panel flex items-center gap-2 px-4 py-2">
          <span className="kicker shrink-0">{"// live"}</span>
          <ActivityFeed initial={feed} compact />
          <Link href="/leaderboard" className="ml-auto shrink-0 text-xs text-accent hover:underline">
            all →
          </Link>
        </div>
      )}

      {announcements.length > 0 && (
        <section className="border border-signal/40 bg-signal/[0.06] p-4">
          <div className="kicker text-signal">{"// broadcast"}</div>
          <ul className="mt-2 space-y-2">
            {announcements.map((a) => (
              <li key={a.id} className="text-sm">
                <span className="font-mono text-xs text-ink-faint">
                  {new Date(a.createdAt).toLocaleTimeString()} ·{" "}
                </span>
                <Markdown className="inline">{a.bodyMd}</Markdown>
              </li>
            ))}
          </ul>
        </section>
      )}

      {phase === "before" && (
        <p className="panel border-signal/30 p-4 text-sm text-signal">
          The event hasn&apos;t started. You can scout the map, but nothing&apos;s crackable
          until {event && new Date(event.startsAt).toUTCString()}.
        </p>
      )}

      <section>
        <div className="flex items-end justify-between">
          <div>
            <div className="kicker">{"// the stack"}</div>
            <p className="mt-0.5 text-sm text-ink-dim">
              Open rooms are yours to walk into. Locked doors need a keycard; a couple only
              open on a timer.
            </p>
          </div>
          <Link
            href="/market"
            className="hidden shrink-0 text-xs text-accent hover:underline sm:inline"
          >
            visit the shop →
          </Link>
        </div>
        <div className="mt-3">
          <RoomsView cards={cards} />
        </div>
      </section>
    </div>
  );
}
