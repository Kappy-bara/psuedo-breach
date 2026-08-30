import Link from "next/link";
import { signOut } from "@/auth";

const links = [
  { href: "/dashboard", label: "modules" },
  { href: "/terminal", label: "terminal" },
  { href: "/leaderboard", label: "board" },
  { href: "/demo", label: "guide" },
];

export function Nav({
  displayName,
  score,
  rank,
  isAdmin,
}: {
  displayName: string;
  score: number;
  rank?: number | null;
  isAdmin?: boolean;
}) {
  return (
    <header className="border-b border-border bg-panel/70 backdrop-blur sticky top-0 z-40">
      <div className="mx-auto max-w-6xl px-4 h-14 flex items-center gap-5 text-sm">
        <Link href="/dashboard" className="font-bold tracking-widest text-accent">
          PSEUDO<span className="text-ink-dim">·</span>BREACH
        </Link>
        <nav className="flex items-center gap-4 text-ink-dim">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-ink transition-colors">
              {l.label}
            </Link>
          ))}
          {isAdmin && (
            <Link href="/admin" className="hover:text-ink text-accent-amber transition-colors">
              admin
            </Link>
          )}
        </nav>
        <div className="ml-auto flex items-center gap-4">
          <span className="text-ink-dim hidden sm:inline">
            {displayName}
            {typeof rank === "number" && <span className="text-ink-dim"> · #{rank}</span>}
          </span>
          <span className="text-accent font-bold tabular-nums">{score} pts</span>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button className="text-ink-dim hover:text-accent-red transition-colors">exit</button>
          </form>
        </div>
      </div>
    </header>
  );
}
