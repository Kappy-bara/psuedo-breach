import { z } from "zod";
import { json, withUser, limitOr429, clientIp, rateLimiters } from "@/lib/api";
import { submitAnswer } from "@/lib/submit";

const Body = z.object({
  puzzleSlug: z.string().min(1).max(80),
  value: z.string().min(1).max(2000),
});

export const POST = withUser(async (user, req) => {
  const ip = clientIp(req);
  const limited =
    (await limitOr429(rateLimiters.submitUser, user.id)) ??
    (await limitOr429(rateLimiters.submitIp, ip));
  if (limited) return limited;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "bad request" }, 400);

  const outcome = await submitAnswer(user, parsed.data.puzzleSlug, parsed.data.value, ip);
  const httpStatus =
    outcome.status === "not-found"
      ? 404
      : outcome.status === "closed" || outcome.status === "locked"
        ? 403
        : 200;
  return json({ outcome }, httpStatus);
});
