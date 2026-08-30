import { prisma } from "@/lib/db";

export type FeedKind =
  | "solve"
  | "first-blood"
  | "room-clear"
  | "forge"
  | "achievement"
  | "milestone";

export interface FeedRow {
  id: string;
  kind: FeedKind;
  actorName: string;
  title: string;
  meta: Record<string, unknown>;
  at: number;
}

/** Fire-and-forget: never let a feed write break the thing that triggered it. */
export async function emitFeed(
  eventId: string,
  kind: FeedKind,
  data: { actorId?: string | null; actorName?: string; title: string; meta?: Record<string, unknown> },
): Promise<void> {
  try {
    await prisma.feedEvent.create({
      data: {
        eventId,
        kind,
        actorId: data.actorId ?? null,
        actorName: data.actorName ?? "",
        title: data.title,
        meta: JSON.stringify(data.meta ?? {}),
      },
    });
  } catch {
    /* swallow */
  }
}

const feedCache = new Map<string, { at: number; rows: FeedRow[] }>();
const FEED_TTL_MS = 4000;

export async function getFeed(eventId: string, take = 40): Promise<FeedRow[]> {
  const cached = feedCache.get(eventId);
  if (cached && Date.now() - cached.at < FEED_TTL_MS) return cached.rows;

  const rows = await prisma.feedEvent.findMany({
    where: { eventId },
    orderBy: { createdAt: "desc" },
    take,
  });
  const mapped: FeedRow[] = rows.map((r) => ({
    id: r.id,
    kind: r.kind as FeedKind,
    actorName: r.actorName,
    title: r.title,
    meta: JSON.parse(r.meta || "{}"),
    at: r.createdAt.getTime(),
  }));
  feedCache.set(eventId, { at: Date.now(), rows: mapped });
  return mapped;
}
