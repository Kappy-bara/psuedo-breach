"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

function randomPassword(): string {
  const words = ["ghost", "vault", "cipher", "signal", "proxy", "token", "shell", "breach", "relay", "kernel"];
  const w = () => words[Math.floor(Math.random() * words.length)]!;
  return `${w()}-${w()}-${Math.floor(1000 + Math.random() * 9000)}`;
}

async function logAdmin(actorId: string, action: string, targetId: string, meta: unknown = {}) {
  await prisma.auditLog.create({
    data: { action, actorId, targetType: "event", targetId, meta: JSON.stringify(meta) },
  });
}

export async function setEventStatus(formData: FormData) {
  const admin = await requireAdmin();
  const eventId = String(formData.get("eventId"));
  const status = String(formData.get("status"));
  if (!["draft", "live", "ended"].includes(status)) return;
  await prisma.event.update({ where: { id: eventId }, data: { status } });
  await logAdmin(admin.id, "event-status", eventId, { status });
  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

/** Go live right now: start = now, end = now + the event's current duration, status = live. */
export async function startEventNow(formData: FormData) {
  const admin = await requireAdmin();
  const eventId = String(formData.get("eventId"));
  const ev = await prisma.event.findUnique({ where: { id: eventId } });
  if (!ev) return;
  const spanMs = Math.max(3600_000, ev.endsAt.getTime() - ev.startsAt.getTime());
  const startsAt = new Date();
  const endsAt = new Date(startsAt.getTime() + spanMs);
  await prisma.event.update({ where: { id: eventId }, data: { status: "live", startsAt, endsAt } });
  await logAdmin(admin.id, "event-start-now", eventId, { startsAt, endsAt });
  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

/** Set start/end explicitly from datetime-local inputs (interpreted as UTC). */
export async function setEventWindow(formData: FormData) {
  const admin = await requireAdmin();
  const eventId = String(formData.get("eventId"));
  const startsAt = new Date(String(formData.get("startsAt")) + "Z");
  const endsAt = new Date(String(formData.get("endsAt")) + "Z");
  if (isNaN(+startsAt) || isNaN(+endsAt) || endsAt <= startsAt) return;
  await prisma.event.update({ where: { id: eventId }, data: { startsAt, endsAt } });
  await logAdmin(admin.id, "event-window", eventId, { startsAt, endsAt });
  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

/** Add minutes to the end time (the "give everyone 15 more minutes" button). */
export async function extendEvent(formData: FormData) {
  const admin = await requireAdmin();
  const eventId = String(formData.get("eventId"));
  const minutes = Math.max(-240, Math.min(240, Number(formData.get("minutes") ?? 0)));
  const ev = await prisma.event.findUnique({ where: { id: eventId } });
  if (!ev || !minutes) return;
  const endsAt = new Date(ev.endsAt.getTime() + minutes * 60_000);
  await prisma.event.update({ where: { id: eventId }, data: { endsAt } });
  await logAdmin(admin.id, "event-extend", eventId, { minutes, endsAt });
  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

export async function postAnnouncement(formData: FormData) {
  const admin = await requireAdmin();
  const eventId = String(formData.get("eventId"));
  const bodyMd = String(formData.get("bodyMd") ?? "").trim().slice(0, 2000);
  if (!bodyMd) return;
  await prisma.announcement.create({ data: { eventId, bodyMd } });
  await prisma.auditLog.create({
    data: { action: "announce", actorId: admin.id, targetType: "event", targetId: eventId, meta: JSON.stringify({ bodyMd }) },
  });
  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

export async function deleteAnnouncement(formData: FormData) {
  await requireAdmin();
  await prisma.announcement.delete({ where: { id: String(formData.get("id")) } });
  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

export async function clearAnnouncements(formData: FormData) {
  const admin = await requireAdmin();
  const eventId = String(formData.get("eventId"));
  await prisma.announcement.deleteMany({ where: { eventId } });
  await logAdmin(admin.id, "announce-clear", eventId);
  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

export async function setModuleHidden(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("moduleId"));
  const hidden = String(formData.get("hidden")) === "true";
  await prisma.module.update({ where: { id }, data: { isHidden: hidden } });
  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

export async function setPuzzleHidden(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("puzzleId"));
  const hidden = String(formData.get("hidden")) === "true";
  await prisma.puzzle.update({ where: { id }, data: { isHidden: hidden } });
  revalidatePath("/admin");
}

/** Edit a room's unlock rule (raw JSON — see src/lib/unlock.ts) and/or map position. */
export async function setRoomUnlock(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("moduleId"));
  const raw = String(formData.get("ruleJson") ?? "").trim();
  const data: { unlockRuleJson?: string; mapX?: number; mapY?: number } = {};
  if (raw) {
    try {
      JSON.parse(raw); // validate
      data.unlockRuleJson = raw;
    } catch {
      return; // silently reject bad JSON
    }
  }
  const mx = formData.get("mapX");
  const my = formData.get("mapY");
  if (mx !== null && mx !== "") data.mapX = Math.max(0, Math.min(20, Number(mx)));
  if (my !== null && my !== "") data.mapY = Math.max(0, Math.min(20, Number(my)));
  if (Object.keys(data).length === 0) return;
  await prisma.module.update({ where: { id }, data });
  await prisma.auditLog.create({
    data: { action: "room-unlock", actorId: admin.id, targetType: "module", targetId: id, meta: JSON.stringify(data) },
  });
  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

export async function clearFeed(formData: FormData) {
  const admin = await requireAdmin();
  const eventId = String(formData.get("eventId"));
  await prisma.feedEvent.deleteMany({ where: { eventId } });
  await logAdmin(admin.id, "feed-clear", eventId);
  revalidatePath("/admin");
}

/** Drop an item (or creds) into every participant's inventory in one event. */
export async function grantItemToEvent(formData: FormData) {
  const admin = await requireAdmin();
  const eventId = String(formData.get("eventId"));
  const itemKey = String(formData.get("itemKey") ?? "").trim();
  const qty = Math.max(1, Math.min(9999, Number(formData.get("qty") ?? 1)));
  if (!itemKey) return;
  const users = await prisma.user.findMany({
    where: { eventId, role: "participant" },
    select: { id: true },
  });
  for (const u of users) {
    await prisma.inventoryEntry.upsert({
      where: { userId_itemKey: { userId: u.id, itemKey } },
      update: { quantity: { increment: qty } },
      create: { userId: u.id, itemKey, quantity: qty },
    });
  }
  await logAdmin(admin.id, "grant-item-all", eventId, { itemKey, qty, users: users.length });
  revalidatePath("/admin");
}

/** DANGER: wipe every player's progress in one event. Requires typing the event slug. */
export async function wipeEventProgress(formData: FormData) {
  const admin = await requireAdmin();
  const eventId = String(formData.get("eventId"));
  const confirm = String(formData.get("confirm") ?? "");
  const ev = await prisma.event.findUnique({ where: { id: eventId } });
  if (!ev || confirm !== ev.slug) return;
  const userIds = (
    await prisma.user.findMany({ where: { eventId }, select: { id: true } })
  ).map((u) => u.id);
  const w = { userId: { in: userIds } };
  await prisma.submission.deleteMany({ where: w });
  await prisma.solve.deleteMany({ where: w });
  await prisma.inventoryEntry.deleteMany({ where: w });
  await prisma.hintUnlock.deleteMany({ where: w });
  await prisma.tradeExecution.deleteMany({ where: w });
  await prisma.achievementUnlock.deleteMany({ where: w });
  await prisma.feedEvent.deleteMany({ where: { eventId } });
  await logAdmin(admin.id, "wipe-event-progress", eventId, { users: userIds.length });
  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

export async function grantItemToUser(formData: FormData) {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId"));
  const itemKey = String(formData.get("itemKey") ?? "").trim();
  const qty = Math.max(1, Math.min(999, Number(formData.get("qty") ?? 1)));
  if (!itemKey) return;
  await prisma.inventoryEntry.upsert({
    where: { userId_itemKey: { userId, itemKey } },
    update: { quantity: { increment: qty } },
    create: { userId, itemKey, quantity: qty },
  });
  await prisma.auditLog.create({
    data: {
      action: "admin-grant-item",
      actorId: admin.id,
      targetType: "user",
      targetId: userId,
      meta: JSON.stringify({ itemKey, qty }),
    },
  });
  revalidatePath("/admin/users");
}

export async function setUserLocked(formData: FormData) {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId"));
  const locked = String(formData.get("locked")) === "true";
  await prisma.user.update({ where: { id: userId }, data: { isLocked: locked } });
  await prisma.auditLog.create({
    data: { action: locked ? "lock-user" : "unlock-user", actorId: admin.id, targetType: "user", targetId: userId, meta: "{}" },
  });
  revalidatePath("/admin/users");
}

export type ResetState = { registerId: string; password: string } | { error: string } | null;

export async function resetPassword(_prev: ResetState, formData: FormData): Promise<ResetState> {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId"));
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { error: "user not found" };
  const password = randomPassword();
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await bcrypt.hash(password, 10) },
  });
  await prisma.auditLog.create({
    data: { action: "password-reset", actorId: admin.id, targetType: "user", targetId: userId, meta: JSON.stringify({ registerId: user.registerId }) },
  });
  revalidatePath("/admin/users");
  return { registerId: user.registerId, password };
}
