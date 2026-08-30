import { withUser } from "@/lib/api";
import { getLeaderboard } from "@/lib/game";

export const GET = withUser(async (user) => {
  const rows = await getLeaderboard(user.eventId, user.id);
  const you = rows.find((r) => r.userId === user.id) ?? null;

  return new Response(
    JSON.stringify({ rows: rows.slice(0, 100), you, total: rows.length }),
    {
      status: 200,
      headers: {
        "content-type": "application/json",
        "cache-control": "private, max-age=2",
      },
    },
  );
});
