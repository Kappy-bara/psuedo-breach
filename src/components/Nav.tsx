import Link from "next/link";
import { signOut } from "@/auth";
import { CountUp } from "@/components/CountUp";

const links = [
  { href: "/dashboard", label: "map" },
  { href: "/market", label: "shop" },
  { href: "/inventory", label: "inventory" },
  { href: "/achievements", label: "titles" },
  { href: "/leaderboard", label: "board" },
  { href: "/terminal", label: "toolkit" },
];

export function Nav({
  displayName,
  title,
  score,
  creds,
  rank,
  isAdmin,
}: {
  displayName: string;
  title?: string;
  score: number;
  creds: number;
  rank?: number | null;
  isAdmin?: boolean;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 text-sm">
        <Link
          href="/dashboard"
          className="font-display font-bold tracking-[0.12em] text-accent [text-shadow:0_0_18px_rgba(94,179,255,0.4)]"
        >
          PSEUDO<span className="text-ink-faint">/</span>BREACH
        </Link>
        <nav className="hidden items-center gap-0.5 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="px-2 py-1 text-ink-dim transition-colors hover:text-ink"
            >
              {l.label}
            </Link>
          ))}
          {isAdmin && (
            <Link href="/admin" className="px-2 py-1 text-signal transition-colors hover:text-ink">
              admin
            </Link>
          )}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden text-xs text-ink-dim lg:inline">
            {displayName}
            {title && <span className="text-ink-faint"> · {title}</span>}
            {typeof rank === "number" && <span className="text-ink-faint"> · #{rank}</span>}
          </span>
          <span className="hud-chip text-signal">
            💰 <CountUp value={creds} />
          </span>
          <span className="hud-chip font-bold text-accent">
            ▲ <CountUp value={score} /> <span className="font-normal text-ink-faint">pts</span>
          </span>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button className="px-1.5 text-ink-dim transition-colors hover:text-danger">
              exit
            </button>
          </form>
        </div>
      </div>
      <nav className="flex items-center gap-1 overflow-x-auto border-t border-border px-3 py-1.5 text-xs md:hidden">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="shrink-0 px-2 py-1 text-ink-dim">
            {l.label}
          </Link>
        ))}
        {isAdmin && (
          <Link href="/admin" className="shrink-0 px-2 py-1 text-signal">
            admin
          </Link>
        )}
      </nav>
    </header>
  );
}
