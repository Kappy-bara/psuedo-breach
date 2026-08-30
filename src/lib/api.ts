import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { rateLimiters, clientIp } from "@/lib/ratelimit";
import type { User } from "@prisma/client";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function withUser(
  handler: (user: User, req: Request) => Promise<Response>,
) {
  return async (req: Request): Promise<Response> => {
    const user = await getCurrentUser();
    if (!user) return json({ error: "not authenticated" }, 401);
    return handler(user, req);
  };
}

/** Enforce a per-user limiter; returns a 429 Response if exceeded, else null. */
export async function limitOr429(
  limiter: (typeof rateLimiters)[keyof typeof rateLimiters],
  id: string,
): Promise<Response | null> {
  const r = await limiter(id);
  if (!r.success) {
    return json(
      { error: "slow down", retryAfterMs: Math.max(0, r.reset - Date.now()) },
      429,
    );
  }
  return null;
}

export { clientIp, rateLimiters };
