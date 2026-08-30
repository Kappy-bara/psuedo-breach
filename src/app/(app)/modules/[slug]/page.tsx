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
          ← the stack
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">{mod.title}</h1>
        <p className="mt-1 text-ink-dim">{mod.blurb}</p>
        {mod.clearRewardLabel && !mod.cleared && (
          <p className="mt-1 text-xs text-ink-dim">
            clear the whole room for: <span className="text-accent">{mod.clearRewardLabel}</span>
          </p>
        )}
      </div>

      {mod.locked ? (
        <p className="border border-accent-amber/40 bg-accent-amber/[0.06] px-4 py-3 text-sm text-accent-amber">
          🔒 {mod.lockedReason}. You can read what&apos;s in here, but you can&apos;t crack it
          until it opens. Try SUDO.
        </p>
      ) : mod.cleared ? (
        <p className="border border-accent/40 bg-accent/[0.06] px-4 py-3 text-sm text-accent">
          ✓ Room cleared. Loot&apos;s in your satchel.
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <div className="space-y-4">
          {mod.puzzles.map((p) => (
            <PuzzlePanel key={p.slug} puzzle={p} moduleLocked={mod.locked} />
          ))}
        </div>
        <div className="space-y-4">
          <HintPanel hints={mod.hints} />
          <Link
            href="/market"
            className="block panel p-3 text-xs text-ink-dim hover:border-ink-dim"
          >
            <span className="text-accent-cyan">SUDO&apos;s market →</span> buy intel, forge
            keycards, cash in loot.
          </Link>
        </div>
      </div>
    </div>
  );
}
