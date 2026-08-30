/** Centralised env access with sane errors. */

function required(name: string): string {
  const v = process.env[name];
  if (!v || v.length === 0) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(`Missing required environment variable: ${name}`);
    }
    // Dev: fall back to a clearly-insecure placeholder so `npm run dev` works out of the box.
    return `dev-missing-${name}`;
  }
  return v;
}

export const env = {
  authSecret: () => required("AUTH_SECRET"),
  flagSecret: () => required("FLAG_SECRET"),
  upstashUrl: () => process.env.UPSTASH_REDIS_REST_URL ?? "",
  upstashToken: () => process.env.UPSTASH_REDIS_REST_TOKEN ?? "",
  /** Event slug the participant-facing site serves. */
  activeEvent: () => process.env.NEXT_PUBLIC_ACTIVE_EVENT ?? "demo-session",
};
