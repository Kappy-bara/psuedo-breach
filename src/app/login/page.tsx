import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/dashboard");

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <Link href="/" className="text-xs tracking-[0.3em] text-ink-dim hover:text-ink">
          ← PSEUDO·BREACH
        </Link>
        <h1 className="mt-4 text-2xl font-bold">Identify yourself</h1>
        <p className="mt-1 text-sm text-ink-dim">
          Use the register ID and password the organisers gave you.
        </p>
        <div className="mt-6 border border-border bg-panel/60 p-6">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
