import { prisma } from "@/lib/db";
import { parseJson } from "@/lib/json";
import {
  type ItemMap,
  holds,
  grantItems,
  spendItems,
  getInventoryMap,
} from "@/lib/inventory";
import { emitFeed } from "@/lib/feed";
import { checkAchievements } from "@/lib/achievements";
import type { Item, Npc } from "@prisma/client";

export async function getItemCatalog(eventId: string): Promise<Map<string, Item>> {
  const items = await prisma.item.findMany({ where: { eventId } });
  return new Map(items.map((i) => [i.key, i]));
}

export interface TradeView {
  id: string;
  label: string;
  descriptionMd: string;
  give: ItemMap;
  get: ItemMap;
  revealsHintId: string | null;
  repeatable: boolean;
  alreadyDone: boolean;
  affordable: boolean;
  missing: ItemMap;
}

export async function listTrades(
  userId: string,
  eventId: string,
  npcSlug: string,
): Promise<{ npc: Npc; trades: TradeView[]; catalog: Map<string, Item> } | null> {
  const npc = await prisma.npc.findUnique({
    where: { eventId_slug: { eventId, slug: npcSlug } },
    include: { trades: { where: { isHidden: false }, orderBy: { order: "asc" } } },
  });
  if (!npc) return null;

  const [inv, execs, catalog] = await Promise.all([
    getInventoryMap(userId),
    prisma.tradeExecution.findMany({
      where: { userId, tradeId: { in: npc.trades.map((t) => t.id) } },
      select: { tradeId: true },
    }),
    getItemCatalog(eventId),
  ]);
  const done = new Set(execs.map((e) => e.tradeId));

  const trades: TradeView[] = [];
  for (const t of npc.trades) {
    if (!holds(inv, parseJson<ItemMap>(t.showIfHoldsJson, {})).ok) continue;
    const give = parseJson<ItemMap>(t.giveJson, {});
    const get = parseJson<ItemMap>(t.getItemsJson, {});
    const h = holds(inv, give);
    const alreadyDone = !t.repeatable && done.has(t.id);
    trades.push({
      id: t.id,
      label: t.label,
      descriptionMd: t.descriptionMd,
      give,
      get,
      revealsHintId: t.revealsHintId,
      repeatable: t.repeatable,
      alreadyDone,
      affordable: h.ok && !alreadyDone,
      missing: h.missing,
    });
  }

  return { npc, trades, catalog };
}

export type TradeResult =
  | { status: "ok"; got: ItemMap; hintRevealed: string | null }
  | { status: "short"; missing: ItemMap }
  | { status: "done" }
  | { status: "not-found" };

export async function executeTrade(
  userId: string,
  eventId: string,
  tradeId: string,
): Promise<TradeResult> {
  const trade = await prisma.npcTrade.findUnique({
    where: { id: tradeId },
    include: { npc: true },
  });
  if (!trade || trade.isHidden || trade.npc.eventId !== eventId)
    return { status: "not-found" };

  const give = parseJson<ItemMap>(trade.giveJson, {});
  const get = parseJson<ItemMap>(trade.getItemsJson, {});

  // pre-check for a friendly "short" message (the transaction re-checks atomically)
  const pre = holds(await getInventoryMap(userId), give);
  if (!pre.ok) return { status: "short", missing: pre.missing };

  let ok = false;
  try {
    const result = await prisma.$transaction(async (tx) => {
      if (!trade.repeatable) {
        const already = await tx.tradeExecution.findFirst({ where: { userId, tradeId } });
        if (already) return { status: "done" as const };
      }
      await spendItems(userId, give, tx); // atomic gte guard; throws if raced
      await grantItems(userId, get, tx);
      await tx.tradeExecution.create({ data: { userId, tradeId } });

      let hintRevealed: string | null = null;
      if (trade.revealsHintId) {
        await tx.hintUnlock.upsert({
          where: { userId_hintId: { userId, hintId: trade.revealsHintId } },
          update: {},
          create: { userId, hintId: trade.revealsHintId, costPaid: give.cred ?? 0 },
        });
        hintRevealed = trade.revealsHintId;
      }

      await tx.auditLog.create({
        data: {
          action: "trade",
          actorId: userId,
          targetType: "trade",
          targetId: tradeId,
          meta: JSON.stringify({ label: trade.label, give, get }),
        },
      });

      return { status: "ok" as const, got: get, hintRevealed };
    });
    ok = result.status === "ok";
    return result;
  } catch {
    const now = holds(await getInventoryMap(userId), give);
    return { status: "short", missing: now.missing };
  } finally {
    if (ok) {
      const madeKeycard = Object.keys(get).some((k) => k.startsWith("keycard-"));
      if (madeKeycard) {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { displayName: true },
        });
        void emitFeed(eventId, "forge", {
          actorId: userId,
          actorName: user?.displayName ?? "",
          title: `${user?.displayName ?? "someone"} forged ${Object.keys(get)
            .filter((k) => k.startsWith("keycard-"))
            .join(", ")} at the shop`,
          meta: { trade: trade.label },
        });
      }
      void checkAchievements(userId, eventId).catch(() => {});
    }
  }
}
