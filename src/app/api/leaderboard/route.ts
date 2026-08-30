import { withUser } from "@/lib/api";
import { getLeaderboard, getYearBoard } from "@/lib/game";
import { titlesFor } from "@/lib/achievements";

export const GET = withUser(async (user, req) => {
  const view = new URL(req.url).searchParams.get("view");

  if (view === "years") {
    const years = await getYearBoard(user.eventId);
    return new Response(JSON.stringify({ years }), {
      status: 200,
      headers: { "content-type": "application/json", "cache-control": "private, max-age=3" },
    });
  }

  const [rows, titles] = await Promise.all([
    getLeaderboard(user.eventId, user.id),
    titlesFor(user.eventId),
  ]);
  const withTitles = rows.map((r) => ({ ...r, title: titles.get(r.userId) ?? "" }));
  const you = withTitles.find((r) => r.userId === user.id) ?? null;

  return new Response(
    JSON.stringify({ rows: withTitles.slice(0, 100), you, total: withTitles.length }),
    {
      status: 200,
      headers: { "content-type": "application/json", "cache-control": "private, max-age=2" },
    },
  );
});
