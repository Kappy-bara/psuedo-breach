import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

/** itemKey -> quantity */
export type ItemMap = Record<string, number>;

export const CRED = "cred";

type Tx = Prisma.TransactionClient | typeof prisma;

export class InventoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InventoryError";
  }
}

/* ── reads ── */

export async function getInventory(userId: string) {
  return prisma.inventoryEntry.findMany({
    where: { userId, quantity: { gt: 0 } },
  });
}

export async function getInventoryMap(userId: string): Promise<ItemMap> {
  const rows = await getInventory(userId);
  return Object.fromEntries(rows.map((r) => [r.itemKey, r.quantity]));
}

export async function getCreds(userId: string): Promise<number> {
  const e = await prisma.inventoryEntry.findUnique({
    where: { userId_itemKey: { userId, itemKey: CRED } },
  });
  return e?.quantity ?? 0;
}

/** Pure check: does `inv` satisfy `req`? Returns the shortfall per item. */
export function holds(inv: ItemMap, req: ItemMap): { ok: boolean; missing: ItemMap } {
  const missing: ItemMap = {};
  for (const [k, need] of Object.entries(req)) {
    if (need <= 0) continue;
    const have = inv[k] ?? 0;
    if (have < need) missing[k] = need - have;
  }
  return { ok: Object.keys(missing).length === 0, missing };
}

export async function holdsItems(userId: string, req: ItemMap) {
  return holds(await getInventoryMap(userId), req);
}

/* ── writes ── */

/** Add items to a player's inventory. Safe to call outside a transaction. */
export async function grantItems(userId: string, map: ItemMap, tx: Tx = prisma) {
  for (const [itemKey, qty] of Object.entries(map)) {
    if (!qty) continue;
    await tx.inventoryEntry.upsert({
      where: { userId_itemKey: { userId, itemKey } },
      update: { quantity: { increment: qty } },
      create: { userId, itemKey, quantity: qty },
    });
  }
}

/**
 * Remove items. Atomic per item (updateMany with a `gte` guard), so two
 * concurrent spends can't both succeed. Throws InventoryError if short —
 * call inside a `$transaction` so a throw rolls back any partial spend.
 */
export async function spendItems(userId: string, map: ItemMap, tx: Tx = prisma) {
  for (const [itemKey, qty] of Object.entries(map)) {
    if (!qty) continue;
    const res = await tx.inventoryEntry.updateMany({
      where: { userId, itemKey, quantity: { gte: qty } },
      data: { quantity: { decrement: qty } },
    });
    if (res.count === 0) throw new InventoryError(`not enough "${itemKey}"`);
  }
}

/** Deduct creds but never below zero (the honeypot toll). Returns creds actually taken. */
export async function spendCredsFloor(
  userId: string,
  amount: number,
  tx: Tx = prisma,
): Promise<number> {
  const e = await tx.inventoryEntry.findUnique({
    where: { userId_itemKey: { userId, itemKey: CRED } },
  });
  const have = e?.quantity ?? 0;
  const take = Math.min(have, Math.max(0, Math.floor(amount)));
  if (take > 0) {
    await tx.inventoryEntry.update({
      where: { userId_itemKey: { userId, itemKey: CRED } },
      data: { quantity: { decrement: take } },
    });
  }
  return take;
}
