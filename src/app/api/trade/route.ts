import { z } from "zod";
import { json, withUser, limitOr429, rateLimiters } from "@/lib/api";
import { executeTrade } from "@/lib/trade";

const Body = z.object({ tradeId: z.string().min(1).max(60) });

export const POST = withUser(async (user, req) => {
  const limited = await limitOr429(rateLimiters.trade, user.id);
  if (limited) return limited;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "bad request" }, 400);

  const result = await executeTrade(user.id, user.eventId, parsed.data.tradeId);
  const status =
    result.status === "not-found" ? 404 : result.status === "ok" ? 200 : 409;
  return json({ result }, status);
});
