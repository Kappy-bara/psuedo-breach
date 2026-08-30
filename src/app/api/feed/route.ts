import { withUser } from "@/lib/api";
import { getFeed } from "@/lib/feed";

export const GET = withUser(async (user) => {
  const rows = await getFeed(user.eventId, 40);
  return new Response(JSON.stringify({ rows }), {
    status: 200,
    headers: { "content-type": "application/json", "cache-control": "private, max-age=3" },
  });
});
