"use server";

import { headers } from "next/headers";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { rateLimiters } from "@/lib/ratelimit";

export type LoginState = { error: string | null };

export async function authenticate(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "0.0.0.0").split(",")[0]!.trim();
  const limit = await rateLimiters.login(ip);
  if (!limit.success) {
    return { error: "Too many attempts. Wait a minute and try again." };
  }

  try {
    await signIn("credentials", {
      registerId: String(formData.get("registerId") ?? ""),
      password: String(formData.get("password") ?? ""),
      redirectTo: "/dashboard",
    });
    return { error: null };
  } catch (e: any) {
    if (e instanceof AuthError || e?.type === "CredentialsSignin" || e?.name === "CredentialsSignin") {
      return { error: "Wrong register ID or password." };
    }
    throw e; // NEXT_REDIRECT and everything else must propagate
  }
}
