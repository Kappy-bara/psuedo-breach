import { requireUser } from "@/lib/session";
import { getUserScore, getLeaderboard } from "@/lib/game";
import { getCreds } from "@/lib/inventory";
import { titleFor } from "@/lib/achievements";
import { Nav } from "@/components/Nav";
import { ToastProvider } from "@/components/ToastProvider";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const [score, creds, board, title] = await Promise.all([
    getUserScore(user.id),
    getCreds(user.id),
    getLeaderboard(user.eventId, user.id),
    titleFor(user.id),
  ]);
  const rank = board.find((r) => r.userId === user.id)?.rank ?? null;

  return (
    <ToastProvider>
      <Nav
        displayName={user.displayName}
        title={title}
        score={score}
        creds={creds}
        rank={rank}
        isAdmin={user.role === "admin"}
      />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
      <footer className="border-t border-border py-4 text-center font-mono text-xs text-ink-faint">
        PSEUDO-BREACH · a puzzle, not a crime · don&apos;t DoS the box
      </footer>
    </ToastProvider>
  );
}
