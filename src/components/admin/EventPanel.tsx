import {
  setEventStatus,
  startEventNow,
  setEventWindow,
  extendEvent,
  postAnnouncement,
  deleteAnnouncement,
  clearAnnouncements,
  setModuleHidden,
  setPuzzleHidden,
  grantItemToEvent,
  wipeEventProgress,
} from "@/lib/admin";
import type { Announcement, Event, Module, Puzzle } from "@prisma/client";

type EventWithBits = Event & {
  _count: { users: number };
  announcements: Announcement[];
  modules: (Module & { puzzles: Puzzle[] })[];
};

const dtLocal = (d: Date) => new Date(d).toISOString().slice(0, 16);

function phaseOf(ev: Event): { label: string; cls: string } {
  const now = Date.now();
  if (ev.status === "ended" || now > ev.endsAt.getTime())
    return { label: "ENDED", cls: "text-accent-red" };
  if (ev.status === "live") {
    const mins = Math.round((ev.endsAt.getTime() - now) / 60000);
    return {
      label: mins > 0 ? `LIVE · ${mins} min left` : "LIVE",
      cls: "text-accent",
    };
  }
  return { label: "NOT STARTED", cls: "text-accent-amber" };
}

export function EventPanel({ ev }: { ev: EventWithBits }) {
  const phase = phaseOf(ev);

  return (
    <section className="panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-bold">
            {ev.name}{" "}
            <span className="text-xs text-ink-dim">{ev.isDemo ? "(demo)" : "(main)"}</span>
          </h2>
          <p className="text-xs text-ink-dim">
            {ev._count.users} accounts · {ev.modules.length} rooms · slug{" "}
            <code className="text-ink">{ev.slug}</code>
          </p>
          <p className={`mt-1 text-xs ${phase.cls}`}>● {phase.label}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(["draft", "live", "ended"] as const).map((s) => (
            <form action={setEventStatus} key={s}>
              <input type="hidden" name="eventId" value={ev.id} />
              <input type="hidden" name="status" value={s} />
              <button
                disabled={ev.status === s}
                className={`border px-2 py-0.5 text-xs transition-colors ${
                  ev.status === s
                    ? "border-accent text-accent"
                    : "border-border text-ink-dim hover:border-ink-dim"
                }`}
              >
                {s}
              </button>
            </form>
          ))}
          <form action={startEventNow}>
            <input type="hidden" name="eventId" value={ev.id} />
            <button className="border border-accent px-2 py-0.5 text-xs font-bold text-accent transition-colors hover:bg-accent hover:text-bg">
              ▶ go live now
            </button>
          </form>
        </div>
      </div>

      {/* schedule */}
      <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-border pt-4">
        <form action={setEventWindow} className="flex flex-wrap items-end gap-2 text-xs">
          <input type="hidden" name="eventId" value={ev.id} />
          <label className="flex flex-col gap-0.5">
            <span className="text-ink-dim">start (UTC)</span>
            <input
              type="datetime-local"
              name="startsAt"
              defaultValue={dtLocal(ev.startsAt)}
              className="border border-border bg-panel-2 px-2 py-1 outline-none focus:border-accent"
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-ink-dim">end (UTC)</span>
            <input
              type="datetime-local"
              name="endsAt"
              defaultValue={dtLocal(ev.endsAt)}
              className="border border-border bg-panel-2 px-2 py-1 outline-none focus:border-accent"
            />
          </label>
          <button className="border border-border px-2 py-1 text-ink-dim hover:border-ink-dim">
            save
          </button>
        </form>
        <div className="flex items-center gap-1 text-xs text-ink-dim">
          extend:
          {[10, 15, 30, -15].map((m) => (
            <form action={extendEvent} key={m}>
              <input type="hidden" name="eventId" value={ev.id} />
              <input type="hidden" name="minutes" value={m} />
              <button className="border border-border px-1.5 py-1 hover:border-ink-dim">
                {m > 0 ? `+${m}` : m}m
              </button>
            </form>
          ))}
        </div>
      </div>

      {/* announcements */}
      <div className="mt-4 border-t border-border pt-4">
        <form action={postAnnouncement} className="flex gap-2">
          <input type="hidden" name="eventId" value={ev.id} />
          <input
            name="bodyMd"
            placeholder="broadcast an announcement (markdown ok)…"
            className="flex-1 border border-border bg-panel-2 px-3 py-1.5 text-sm outline-none focus:border-accent"
          />
          <button className="border border-accent/50 px-3 text-sm text-accent transition-colors hover:bg-accent hover:text-bg">
            post
          </button>
          {ev.announcements.length > 0 && (
            <button
              formAction={clearAnnouncements}
              className="border border-border px-2 text-xs text-ink-dim hover:border-accent-red hover:text-accent-red"
            >
              clear all
            </button>
          )}
        </form>
        <ul className="mt-2 space-y-1">
          {ev.announcements.map((a) => (
            <li key={a.id} className="flex items-center justify-between text-xs text-ink-dim">
              <span>
                {new Date(a.createdAt).toLocaleTimeString()} — {a.bodyMd}
              </span>
              <form action={deleteAnnouncement}>
                <input type="hidden" name="id" value={a.id} />
                <button className="text-accent-red/70 hover:text-accent-red">delete</button>
              </form>
            </li>
          ))}
        </ul>
      </div>

      {/* room / puzzle visibility */}
      <div className="mt-4 space-y-1.5 border-t border-border pt-4 text-xs">
        <div className="text-ink-dim">rooms &amp; puzzles — click to hide/show</div>
        {ev.modules.map((m) => (
          <div key={m.id} className="flex flex-wrap items-center gap-1.5">
            <form action={setModuleHidden}>
              <input type="hidden" name="moduleId" value={m.id} />
              <input type="hidden" name="hidden" value={String(!m.isHidden)} />
              <button
                className={`border px-2 py-0.5 transition-colors ${
                  m.isHidden
                    ? "border-border text-ink-faint line-through"
                    : "border-accent/40 text-accent"
                }`}
              >
                {m.slug}
              </button>
            </form>
            {m.puzzles.map((p) => (
              <form action={setPuzzleHidden} key={p.id}>
                <input type="hidden" name="puzzleId" value={p.id} />
                <input type="hidden" name="hidden" value={String(!p.isHidden)} />
                <button
                  className={`border px-1.5 py-0.5 transition-colors ${
                    p.isHidden
                      ? "border-border text-ink-faint line-through"
                      : "border-border text-ink-dim hover:border-ink-dim"
                  }`}
                >
                  {p.slug}
                </button>
              </form>
            ))}
          </div>
        ))}
      </div>

      {/* bulk grant + danger */}
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4 border-t border-border pt-4 text-xs">
        <form action={grantItemToEvent} className="flex items-end gap-1">
          <input type="hidden" name="eventId" value={ev.id} />
          <label className="flex flex-col gap-0.5">
            <span className="text-ink-dim">give everyone</span>
            <input
              name="itemKey"
              placeholder="cred"
              className="w-28 border border-border bg-panel-2 px-2 py-1 outline-none focus:border-accent"
            />
          </label>
          <input
            name="qty"
            type="number"
            defaultValue={50}
            min={1}
            className="w-16 border border-border bg-panel-2 px-2 py-1 outline-none focus:border-accent"
          />
          <button className="border border-border px-2 py-1 text-ink-dim hover:border-ink-dim">
            grant to all
          </button>
        </form>

        <form action={wipeEventProgress} className="flex items-end gap-1">
          <input type="hidden" name="eventId" value={ev.id} />
          <label className="flex flex-col gap-0.5">
            <span className="text-accent-red">wipe all progress — type &quot;{ev.slug}&quot;</span>
            <input
              name="confirm"
              placeholder={ev.slug}
              className="w-40 border border-accent-red/40 bg-panel-2 px-2 py-1 outline-none focus:border-accent-red"
            />
          </label>
          <button className="border border-accent-red/50 px-2 py-1 text-accent-red hover:bg-accent-red hover:text-bg">
            wipe
          </button>
        </form>
      </div>
    </section>
  );
}
