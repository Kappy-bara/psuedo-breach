import { requireUser } from "@/lib/session";
import {
  getModuleCards,
  getAnnouncements,
  getEventBySlug,
  userTokenKeys,
  eventPhase,
} from "@/lib/game";
import { prisma } from "@/lib/db";
import { ModuleCard } from "@/components/ModuleCard";
import { Markdown } from "@/components/Markdown";

export default async function Dashboard() {
  const user = await requireUser();
  const event = await prisma.event.findUnique({ where: { id: user.eventId } });
  const [cards, announcements, tokens] = await Promise.all([
    getModuleCards(user),
    getAnnouncements(user.eventId),
    userTokenKeys(user.id),
  ]);

  const phase = event ? eventPhase(event) : "before";
  const cleared = cards.filter((c) => c.puzzleCount > 0 && c.solvedCount === c.puzzleCount).length;

  return (
    <div className="space-y-8">
      {/* profile */}
      <section className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <div className="border border-border bg-panel/60 p-5">
          <div className="text-xs tracking-widest text-ink-dim">OPERATOR</div>
          <div className="mt-1 text-xl font-bold">{user.displayName}</div>
          <div className="mt-1 text-sm text-ink-dim">
            {user.registerId}
            {user.branch && ` · ${user.branch}`}
            {user.year && ` · year ${user.year}`}
          </div>
          <div className="mt-3 text-xs text-ink-dim">
            event: <span className="text-ink">{event?.name}</span> ·{" "}
            <span
              className={
                phase === "open"
                  ? "text-accent"
                  : phase === "ended"
                    ? "text-accent-red"
                    : "text-accent-amber"
              }
            >
              {phase === "open" ? "LIVE" : phase === "ended" ? "ENDED" : "NOT STARTED"}
            </span>
          </div>
        </div>
        <div className="border border-border bg-panel/60 p-5 text-sm sm:min-w-[13rem]">
          <div className="text-xs tracking-widest text-ink-dim">PROGRESS</div>
          <div className="mt-2">
            modules cleared: <span className="text-accent">{cleared}</span> / {cards.length}
          </div>
          <div className="mt-1">
            tokens held:{" "}
            {tokens.size === 0 ? (
              <span className="text-ink-dim">none yet</span>
            ) : (
              [...tokens].map((t) => (
                <span
                  key={t}
                  className="mr-1 inline-block border border-accent/40 px-1 text-xs text-accent"
                >
                  {t}
                </span>
              ))
            )}
          </div>
        </div>
      </section>

      {announcements.length > 0 && (
        <section className="border border-accent-amber/40 bg-accent-amber/[0.06] p-4">
          <div className="text-xs tracking-widest text-accent-amber">// ANNOUNCEMENTS</div>
          <ul className="mt-2 space-y-2">
            {announcements.map((a) => (
              <li key={a.id} className="text-sm">
                <span className="text-ink-dim">
                  {new Date(a.createdAt).toLocaleTimeString()} —{" "}
                </span>
                <Markdown className="inline">{a.bodyMd}</Markdown>
              </li>
            ))}
          </ul>
        </section>
      )}

      {phase === "before" && (
        <p className="border border-border bg-panel/60 p-4 text-sm text-accent-amber">
          The event hasn&apos;t started. Modules are visible but locked for submission until{" "}
          {event && new Date(event.startsAt).toUTCString()}.
        </p>
      )}

      <section>
        <div className="text-xs tracking-widest text-ink-dim">// MODULES</div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((m) => (
            <ModuleCard key={m.slug} m={m} />
          ))}
        </div>
      </section>
    </div>
  );
}
