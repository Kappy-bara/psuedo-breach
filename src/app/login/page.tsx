import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/dashboard");

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="kicker transition-colors hover:text-ink"
        >
          ← pseudo/breach
        </Link>
        <h1 className="mt-4 text-2xl font-bold">
          <span className="cursor-blink">Identify yourself</span>
        </h1>
        <p className="mt-1 text-sm text-ink-dim">
          Register ID and password, both handed to you by the organisers.
        </p>
        <div className="panel mt-6 p-6">
          <LoginForm />
        </div>
        <p className="mt-4 text-xs text-ink-faint">
          Forgot it? Find an organiser — they can reset it.
        </p>
      </div>
    </div>
  );
}
