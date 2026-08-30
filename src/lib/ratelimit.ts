import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { env } from "@/lib/env";

type LimitResult = { success: boolean; remaining: number; reset: number };

/* ── In-memory sliding-window fallback (dev only; per-instance, not durable) ── */
const memory = new Map<string, number[]>();
function memoryLimit(key: string, limit: number, windowMs: number): LimitResult {
  const now = Date.now();
  const hits = (memory.get(key) ?? []).filter((t) => now - t < windowMs);
  const success = hits.length < limit;
  if (success) hits.push(now);
  memory.set(key, hits);
  return {
    success,
    remaining: Math.max(0, limit - hits.length),
    reset: now + windowMs,
  };
}

/* ── Upstash-backed limiters ── */
const useUpstash = Boolean(env.upstashUrl() && env.upstashToken());
const redis = useUpstash
  ? new Redis({ url: env.upstashUrl(), token: env.upstashToken() })
  : null;

function make(tokens: number, window: `${number} s` | `${number} m`, prefix: string) {
  const limiter =
    redis &&
    new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(tokens, window),
      prefix: `pb:${prefix}`,
      analytics: false,
    });
  const [nStr, unit] = window.split(" ");
  const windowMs = Number(nStr) * (unit === "m" ? 60_000 : 1_000);
  return async (id: string): Promise<LimitResult> => {
    if (limiter) {
      const r = await limiter.limit(id);
      return { success: r.success, remaining: r.remaining, reset: r.reset };
    }
    return memoryLimit(`${prefix}:${id}`, tokens, windowMs);
  };
}

export const rateLimiters = {
  /** puzzle answer submissions, per user */
  submitUser: make(5, "10 s", "submit-u"),
  /** puzzle answer submissions, per IP */
  submitIp: make(20, "10 s", "submit-ip"),
  /** login attempts, per IP */
  login: make(10, "60 s", "login"),
  /** hint unlocks, per user */
  hint: make(10, "60 s", "hint"),
  /** NPC trades, per user */
  trade: make(12, "10 s", "trade"),
};

export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "0.0.0.0";
}
