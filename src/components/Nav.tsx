import Link from "next/link";
import { signOut } from "@/auth";

const links = [
  { href: "/dashboard", label: "rooms" },
  { href: "/market", label: "SUDO" },
  { href: "/inventory", label: "satchel" },
  { href: "/leaderboard", label: "board" },
  { href: "/terminal", label: "toolkit" },
];

export function Nav({
  displayName,
  score,
  creds,
  rank,
  isAdmin,
}: {
  displayName: string;
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
          className="font-bold tracking-[0.15em] text-accent [text-shadow:0_0_18px_rgba(74,222,128,0.35)]"
        >
          PSEUDO<span className="text-ink-faint">/</span>BREACH
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
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
            <Link
              href="/admin"
              className="px-2 py-1 text-accent-amber transition-colors hover:text-ink"
            >
              admin
            </Link>
          )}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden text-xs text-ink-dim lg:inline">
            {displayName}
            {typeof rank === "number" && <span className="text-ink-faint"> · rank #{rank}</span>}
          </span>
          <span className="hud-chip text-accent-amber tabular-nums">💰 {creds}</span>
          <span className="hud-chip font-bold text-accent tabular-nums">
            ▲ {score} pts
          </span>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button className="px-1.5 text-ink-dim transition-colors hover:text-accent-red">
              exit
            </button>
          </form>
        </div>
      </div>
      {/* mobile nav */}
      <nav className="flex items-center gap-1 overflow-x-auto border-t border-border px-3 py-1.5 text-xs md:hidden">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="shrink-0 px-2 py-1 text-ink-dim">
            {l.label}
          </Link>
        ))}
        {isAdmin && (
          <Link href="/admin" className="shrink-0 px-2 py-1 text-accent-amber">
            admin
          </Link>
        )}
      </nav>
    </header>
  );
}
