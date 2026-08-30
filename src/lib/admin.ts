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

export async function setEventStatus(formData: FormData) {
  const admin = await requireAdmin();
  const eventId = String(formData.get("eventId"));
  const status = String(formData.get("status"));
  if (!["draft", "live", "ended"].includes(status)) return;
  await prisma.event.update({ where: { id: eventId }, data: { status } });
  await prisma.auditLog.create({
    data: { action: "event-status", actorId: admin.id, targetType: "event", targetId: eventId, meta: JSON.stringify({ status }) },
  });
  revalidatePath("/admin");
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

export async function setModuleHidden(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("moduleId"));
  const hidden = String(formData.get("hidden")) === "true";
  await prisma.module.update({ where: { id }, data: { isHidden: hidden } });
  revalidatePath("/admin");
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
