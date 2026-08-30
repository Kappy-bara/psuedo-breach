import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { setUserLocked } from "@/lib/admin";
import { getLeaderboard } from "@/lib/game";
import { ResetPasswordButton } from "./ResetPasswordButton";

export default async function AdminUsers({ searchParams }: PageProps<"/">) {
  await requireAdmin();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";

  const events = await prisma.event.findMany({ orderBy: { isDemo: "desc" } });

  const users = await prisma.user.findMany({
    where: q
      ? {
          OR: [
            { registerId: { contains: q } },
            { displayName: { contains: q } },
          ],
        }
      : undefined,
    orderBy: [{ role: "desc" }, { registerId: "asc" }],
    include: {
      event: { select: { slug: true } },
      _count: { select: { solves: true, submissions: true } },
    },
  });

  // score lookup per event
  const boards = new Map<string, Map<string, number>>();
  for (const ev of events) {
    const rows = await getLeaderboard(ev.id);
    boards.set(ev.id, new Map(rows.map((r) => [r.userId, r.score])));
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Users ({users.length})</h1>

      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="search register id or name…"
          className="border border-border bg-panel-2 px-3 py-1.5 text-sm outline-none focus:border-accent"
        />
        <button className="border border-border px-3 text-sm text-ink-dim hover:border-ink-dim">
          search
        </button>
      </form>

      <div className="overflow-x-auto border border-border">
        <table className="w-full text-sm">
          <thead className="bg-panel-2 text-left text-xs tracking-widest text-ink-dim">
            <tr>
              <th className="p-2">register id</th>
              <th className="p-2">name</th>
              <th className="p-2">event</th>
              <th className="p-2 text-right">solves</th>
              <th className="p-2 text-right">score</th>
              <th className="p-2">state</th>
              <th className="p-2">actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-border/60">
                <td className="p-2 font-bold">
                  {u.registerId}
                  {u.role === "admin" && (
                    <span className="ml-1 text-xs text-accent-amber">admin</span>
                  )}
                </td>
                <td className="p-2">{u.displayName}</td>
                <td className="p-2 text-ink-dim">{u.event.slug}</td>
                <td className="p-2 text-right tabular-nums text-ink-dim">{u._count.solves}</td>
                <td className="p-2 text-right tabular-nums">
                  {boards.get(u.eventId)?.get(u.id) ?? 0}
                </td>
                <td className="p-2">
                  {u.isLocked ? (
                    <span className="text-accent-red">locked</span>
                  ) : (
                    <span className="text-accent">ok</span>
                  )}
                </td>
                <td className="p-2">
                  <div className="flex items-center gap-2">
                    <form action={setUserLocked}>
                      <input type="hidden" name="userId" value={u.id} />
                      <input type="hidden" name="locked" value={String(!u.isLocked)} />
                      <button className="border border-border px-2 py-0.5 text-xs text-ink-dim hover:border-ink-dim">
                        {u.isLocked ? "unlock" : "lock"}
                      </button>
                    </form>
                    <ResetPasswordButton userId={u.id} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-ink-dim">
        Bulk-create accounts with{" "}
        <code className="text-ink">npm run accounts -- --count 120 --event pseudo-breach-main</code>{" "}
        — it writes <code className="text-ink">accounts.csv</code>.
      </p>
    </div>
  );
}
