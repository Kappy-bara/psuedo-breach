import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getModuleCards, getAnnouncements, getItemCatalog, eventPhase } from "@/lib/game";
import { getInventory, getCreds, CRED } from "@/lib/inventory";
import { prisma } from "@/lib/db";
import { ModuleCard } from "@/components/ModuleCard";
import { ItemChip } from "@/components/ItemChip";
import { Markdown } from "@/components/Markdown";

export default async function Dashboard() {
  const user = await requireUser();
  const event = await prisma.event.findUnique({ where: { id: user.eventId } });
  const [cards, announcements, inv, creds, catalog] = await Promise.all([
    getModuleCards(user),
    getAnnouncements(user.eventId),
    getInventory(user.id),
    getCreds(user.id),
    getItemCatalog(user.eventId),
  ]);

  const phase = event ? eventPhase(event) : "before";
  const cleared = cards.filter((c) => c.cleared).length;
  const carried = inv.filter((e) => e.itemKey !== CRED);
  const phaseTag =
    phase === "open"
      ? { t: "LIVE", c: "text-accent" }
      : phase === "ended"
        ? { t: "ENDED", c: "text-accent-red" }
        : { t: "NOT STARTED", c: "text-accent-amber" };

  return (
    <div className="space-y-8">
      {/* HUD */}
      <section className="grid gap-3 md:grid-cols-[1.4fr_1fr]">
        <div className="panel p-5">
          <div className="kicker">operator</div>
          <div className="mt-1 flex items-baseline gap-3">
            <span className="text-xl font-bold">{user.displayName}</span>
            <span className={`text-xs ${phaseTag.c}`}>● {phaseTag.t}</span>
          </div>
          <div className="mt-1 text-sm text-ink-dim">
            {user.registerId}
            {user.branch && ` · ${user.branch}`}
            {user.year && ` · year ${user.year}`}
          </div>
          <div className="mt-3 text-xs text-ink-faint">{event?.name}</div>
        </div>

        <div className="panel p-5">
          <div className="flex items-center justify-between">
            <div className="kicker">satchel</div>
            <Link href="/inventory" className="text-xs text-ink-dim hover:text-ink">
              open →
            </Link>
          </div>
          <div className="mt-2 flex items-center gap-4 text-sm">
            <span className="text-accent-amber">💰 {creds}</span>
            <span className="text-ink-dim">
              rooms <span className="text-accent">{cleared}</span>/{cards.length}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {carried.length === 0 ? (
              <span className="text-xs text-ink-faint">no loot yet</span>
            ) : (
              carried
                .slice(0, 8)
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
        </div>
      </section>

      {announcements.length > 0 && (
        <section className="border border-accent-amber/40 bg-accent-amber/[0.06] p-4">
          <div className="kicker text-accent-amber">// broadcast</div>
          <ul className="mt-2 space-y-2">
            {announcements.map((a) => (
              <li key={a.id} className="text-sm">
                <span className="text-ink-faint">
                  {new Date(a.createdAt).toLocaleTimeString()} ·{" "}
                </span>
                <Markdown className="inline">{a.bodyMd}</Markdown>
              </li>
            ))}
          </ul>
        </section>
      )}

      {phase === "before" && (
        <p className="panel border-accent-amber/30 p-4 text-sm text-accent-amber">
          The event hasn&apos;t started. Look around all you like — you can&apos;t crack anything
          until {event && new Date(event.startsAt).toUTCString()}.
        </p>
      )}

      {/* the descent */}
      <section>
        <div className="flex items-end justify-between">
          <div>
            <div className="kicker">// the stack</div>
            <p className="mt-0.5 text-sm text-ink-dim">
              Descend room by room. Locked doors need a keycard — forge them at SUDO.
            </p>
          </div>
          <Link
            href="/market"
            className="hidden shrink-0 text-xs text-accent-cyan hover:underline sm:inline"
          >
            visit SUDO →
          </Link>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((m) => (
            <ModuleCard key={m.slug} m={m} />
          ))}
        </div>
      </section>
    </div>
  );
}
