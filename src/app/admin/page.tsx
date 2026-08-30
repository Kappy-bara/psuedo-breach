import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import {
  setEventStatus,
  postAnnouncement,
  deleteAnnouncement,
  setModuleHidden,
} from "@/lib/admin";

export default async function AdminHome() {
  await requireAdmin();

  const events = await prisma.event.findMany({
    orderBy: { isDemo: "desc" },
    include: {
      _count: { select: { users: true, modules: true } },
      announcements: { orderBy: { createdAt: "desc" }, take: 10 },
      modules: { orderBy: { order: "asc" }, include: { _count: { select: { puzzles: true } } } },
    },
  });

  const [recentSolves, anomalies, recentTrades] = await Promise.all([
    prisma.solve.findMany({
      orderBy: { solvedAt: "desc" },
      take: 15,
      include: { user: { select: { displayName: true } }, puzzle: { select: { title: true, slug: true } } },
    }),
    prisma.auditLog.findMany({
      where: { action: "flag-owner-mismatch" },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.auditLog.findMany({
      where: { action: "trade" },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
  ]);
  const traderNames = new Map(
    (
      await prisma.user.findMany({
        where: { id: { in: recentTrades.map((t) => t.actorId ?? "") } },
        select: { id: true, displayName: true },
      })
    ).map((u) => [u.id, u.displayName]),
  );

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Event Control</h1>

      {events.map((ev) => (
        <section key={ev.id} className="border border-border bg-panel/60 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-bold">
                {ev.name}{" "}
                <span className="text-xs text-ink-dim">
                  {ev.isDemo ? "(demo)" : "(main)"}
                </span>
              </h2>
              <p className="text-xs text-ink-dim">
                {ev._count.users} users · {ev._count.modules} modules ·{" "}
                {new Date(ev.startsAt).toUTCString()} → {new Date(ev.endsAt).toUTCString()}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-ink-dim">status: {ev.status}</span>
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
            </div>
          </div>

          {/* announcements */}
          <div className="mt-4">
            <form action={postAnnouncement} className="flex gap-2">
              <input type="hidden" name="eventId" value={ev.id} />
              <input
                name="bodyMd"
                placeholder="broadcast an announcement (markdown ok)…"
                className="flex-1 border border-border bg-panel-2 px-3 py-1.5 text-sm outline-none focus:border-accent"
              />
              <button className="border border-accent/50 px-3 text-sm text-accent hover:bg-accent hover:text-bg transition-colors">
                post
              </button>
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

          {/* module visibility */}
          <div className="mt-4 flex flex-wrap gap-1.5">
            {ev.modules.map((m) => (
              <form action={setModuleHidden} key={m.id}>
                <input type="hidden" name="moduleId" value={m.id} />
                <input type="hidden" name="hidden" value={String(!m.isHidden)} />
                <button
                  className={`border px-2 py-0.5 text-xs transition-colors ${
                    m.isHidden
                      ? "border-border text-ink-dim line-through"
                      : "border-accent/40 text-accent"
                  }`}
                  title={m.isHidden ? "hidden — click to show" : "visible — click to hide"}
                >
                  {m.slug} ({m._count.puzzles})
                </button>
              </form>
            ))}
          </div>
        </section>
      ))}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="border border-border bg-panel/60 p-5">
          <h2 className="text-xs tracking-widest text-ink-dim">// RECENT SOLVES</h2>
          <ul className="mt-3 space-y-1 text-sm">
            {recentSolves.map((s) => (
              <li key={s.id} className="flex justify-between text-ink-dim">
                <span>
                  <span className="text-ink">{s.user.displayName}</span> → {s.puzzle.title}
                </span>
                <span className="tabular-nums">
                  +{s.basePts + s.bonusPts}
                  {s.solveIndex === 0 && <span className="text-accent-red"> 🩸</span>}
                </span>
              </li>
            ))}
            {recentSolves.length === 0 && <li className="text-ink-dim">no solves yet</li>}
          </ul>
        </section>

        <section className="border border-accent-red/30 bg-accent-red/[0.05] p-5">
          <h2 className="text-xs tracking-widest text-accent-red">// FLAG-SHARING FLAGS</h2>
          <ul className="mt-3 space-y-1 text-sm text-ink-dim">
            {anomalies.map((a) => {
              const meta = JSON.parse(a.meta || "{}");
              return (
                <li key={a.id}>
                  {new Date(a.createdAt).toLocaleTimeString()} — user{" "}
                  <span className="text-ink">{meta.submittedBy}</span> submitted a flag minted
                  for <span className="text-ink">{meta.mintedFor}</span> ({meta.puzzle})
                </li>
              );
            })}
            {anomalies.length === 0 && <li>nothing flagged</li>}
          </ul>
        </section>

        <section className="border border-border bg-panel/60 p-5">
          <h2 className="text-xs tracking-widest text-ink-dim">// RECENT TRADES (SUDO)</h2>
          <ul className="mt-3 space-y-1 text-sm text-ink-dim">
            {recentTrades.map((t) => {
              const meta = JSON.parse(t.meta || "{}");
              return (
                <li key={t.id}>
                  <span className="text-ink">
                    {traderNames.get(t.actorId ?? "") ?? "someone"}
                  </span>{" "}
                  — {meta.label}
                </li>
              );
            })}
            {recentTrades.length === 0 && <li>no trades yet</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
