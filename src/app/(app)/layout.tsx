import { requireUser } from "@/lib/session";
import { getUserScore, getLeaderboard } from "@/lib/game";
import { Nav } from "@/components/Nav";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const [score, board] = await Promise.all([
    getUserScore(user.id),
    getLeaderboard(user.eventId, user.id),
  ]);
  const rank = board.find((r) => r.userId === user.id)?.rank ?? null;

  return (
    <>
      <Nav
        displayName={user.displayName}
        score={score}
        rank={rank}
        isAdmin={user.role === "admin"}
      />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
      <footer className="border-t border-border py-4 text-center text-xs text-ink-dim">
        PSEUDO-BREACH · this is a puzzle, not a crime · don&apos;t DoS the box
      </footer>
    </>
  );
}
