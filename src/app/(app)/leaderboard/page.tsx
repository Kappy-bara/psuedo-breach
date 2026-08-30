import { requireUser } from "@/lib/session";
import { getLeaderboard } from "@/lib/game";
import { SCORING_EXPLAINER } from "@/lib/scoring";
import { LeaderboardLive } from "@/components/LeaderboardLive";
import { Markdown } from "@/components/Markdown";

export default async function LeaderboardPage() {
  const user = await requireUser();
  const rows = await getLeaderboard(user.eventId, user.id);
  const you = rows.find((r) => r.userId === user.id) ?? null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">leaderboard</h1>
      <div className="panel p-5">
        <LeaderboardLive
          initial={{ rows: rows.slice(0, 100), you, total: rows.length }}
        />
      </div>
      <details className="panel p-4 text-sm text-ink-dim">
        <summary className="cursor-pointer text-ink">how scoring works</summary>
        <Markdown className="mt-3">{SCORING_EXPLAINER}</Markdown>
      </details>
    </div>
  );
}
