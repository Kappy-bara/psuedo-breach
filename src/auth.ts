import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";

const CredsSchema = z.object({
  registerId: z.string().min(1).max(64),
  password: z.string().min(1).max(256),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: env.authSecret(),
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 },
  pages: { signIn: "/login" },
  trustHost: true,
  providers: [
    Credentials({
      credentials: { registerId: {}, password: {} },
      authorize: async (raw) => {
        const parsed = CredsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { registerId, password } = parsed.data;

        const user = await prisma.user.findUnique({
          where: { registerId: registerId.trim() },
        });
        if (!user || user.isLocked) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          name: user.displayName,
          registerId: user.registerId,
          role: user.role,
          eventId: user.eventId,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id as string;
        token.role = (user as { role?: string }).role ?? "participant";
        token.registerId = (user as { registerId?: string }).registerId ?? "";
        token.eventId = (user as { eventId?: string }).eventId ?? "";
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = (token.uid as string) ?? "";
        session.user.role = (token.role as string) ?? "participant";
        session.user.registerId = (token.registerId as string) ?? "";
        session.user.eventId = (token.eventId as string) ?? "";
      }
      return session;
    },
  },
});
