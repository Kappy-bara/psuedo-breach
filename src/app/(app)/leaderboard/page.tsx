import { requireUser } from "@/lib/session";
import { getLeaderboard, getYearBoard } from "@/lib/game";
import { titlesFor } from "@/lib/achievements";
import { getFeed } from "@/lib/feed";
import { SCORING_EXPLAINER } from "@/lib/scoring";
import { LeaderboardLive } from "@/components/LeaderboardLive";
import { ActivityFeed } from "@/components/ActivityFeed";
import { Markdown } from "@/components/Markdown";

export default async function LeaderboardPage() {
  const user = await requireUser();
  const [rows, years, titles, feed] = await Promise.all([
    getLeaderboard(user.eventId, user.id),
    getYearBoard(user.eventId),
    titlesFor(user.eventId),
    getFeed(user.eventId, 40),
  ]);
  const withTitles = rows.map((r) => ({ ...r, title: titles.get(r.userId) ?? "" }));
  const you = withTitles.find((r) => r.userId === user.id) ?? null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Leaderboard</h1>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="panel p-5">
          <LeaderboardLive
            initial={{ rows: withTitles.slice(0, 100), you, total: withTitles.length, years }}
          />
        </div>
        <div className="panel p-5">
          <div className="kicker">{"// activity"}</div>
          <div className="mt-3">
            <ActivityFeed initial={feed} />
          </div>
        </div>
      </div>

      <details className="panel p-4 text-sm text-ink-dim">
        <summary className="cursor-pointer text-ink">how scoring works</summary>
        <Markdown className="mt-3">{SCORING_EXPLAINER}</Markdown>
      </details>
    </div>
  );
}
