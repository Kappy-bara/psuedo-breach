import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getModuleDetail } from "@/lib/game";
import { PuzzlePanel } from "@/components/PuzzlePanel";
import { HintPanel } from "@/components/HintPanel";

export default async function ModulePage({ params }: PageProps<"/modules/[slug]">) {
  const { slug } = await params;
  const user = await requireUser();
  const mod = await getModuleDetail(user, slug);
  if (!mod) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard" className="text-xs text-ink-dim hover:text-ink">
          ← all modules
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">{mod.title}</h1>
        <p className="mt-1 text-ink-dim">{mod.blurb}</p>
      </div>

      {mod.locked && (
        <p className="border border-accent-amber/40 bg-accent-amber/[0.06] px-4 py-3 text-sm text-accent-amber">
          🔒 {mod.lockedReason}. You can read the puzzles, but you can&apos;t submit until this
          opens.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          {mod.puzzles.map((p) => (
            <PuzzlePanel key={p.slug} puzzle={p} moduleLocked={mod.locked} />
          ))}
        </div>
        <div className="space-y-4">
          <HintPanel hints={mod.hints} />
          <Link
            href="/terminal"
            className="block border border-border bg-panel/60 p-4 text-sm text-ink-dim hover:border-ink-dim"
          >
            <span className="text-accent-cyan">open the terminal →</span>
            <br />
            Run <code className="text-ink">probe(&quot;{mod.slug}&quot;)</code> or{" "}
            <code className="text-ink">knock(&quot;{mod.slug}&quot;, ...)</code> for things this
            page won&apos;t tell you.
          </Link>
        </div>
      </div>
    </div>
  );
}
