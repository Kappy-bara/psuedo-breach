import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { EventPanel } from "@/components/admin/EventPanel";

export default async function AdminHome() {
  await requireAdmin();

  const events = await prisma.event.findMany({
    orderBy: { isDemo: "desc" },
    include: {
      _count: { select: { users: true } },
      announcements: { orderBy: { createdAt: "desc" }, take: 10 },
      modules: {
        orderBy: { order: "asc" },
        include: { puzzles: { orderBy: { order: "asc" } } },
      },
    },
  });

  const [recentSolves, anomalies, recentTrades, adminLog] = await Promise.all([
    prisma.solve.findMany({
      orderBy: { solvedAt: "desc" },
      take: 15,
      include: {
        user: { select: { displayName: true } },
        puzzle: { select: { title: true } },
      },
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
    prisma.auditLog.findMany({
      where: {
        action: {
          in: [
            "event-status",
            "event-start-now",
            "event-window",
            "event-extend",
            "grant-item-all",
            "wipe-event-progress",
            "announce-clear",
          ],
        },
      },
      orderBy: { createdAt: "desc" },
      take: 12,
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
        <EventPanel key={ev.id} ev={ev} />
      ))}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="panel p-5">
          <h2 className="kicker">// recent solves</h2>
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
            {recentSolves.length === 0 && <li className="text-ink-dim">nothing yet</li>}
          </ul>
        </section>

        <section className="border border-accent-red/30 bg-accent-red/[0.05] p-5">
          <h2 className="kicker text-accent-red">// flag-sharing</h2>
          <ul className="mt-3 space-y-1 text-sm text-ink-dim">
            {anomalies.map((a) => {
              const meta = JSON.parse(a.meta || "{}");
              return (
                <li key={a.id}>
                  {new Date(a.createdAt).toLocaleTimeString()} —{" "}
                  <span className="text-ink">{meta.submittedBy}</span> used{" "}
                  <span className="text-ink">{meta.mintedFor}</span>&apos;s flag ({meta.puzzle})
                </li>
              );
            })}
            {anomalies.length === 0 && <li>nothing flagged</li>}
          </ul>
        </section>

        <section className="panel p-5">
          <h2 className="kicker">// recent trades (SUDO)</h2>
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

        <section className="panel p-5">
          <h2 className="kicker">// admin actions</h2>
          <ul className="mt-3 space-y-1 text-sm text-ink-dim">
            {adminLog.map((a) => (
              <li key={a.id}>
                {new Date(a.createdAt).toLocaleTimeString()} —{" "}
                <span className="text-ink">{a.action}</span>{" "}
                <span className="text-ink-faint">{a.meta !== "{}" && a.meta}</span>
              </li>
            ))}
            {adminLog.length === 0 && <li>none</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
