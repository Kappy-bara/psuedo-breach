import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getModuleDetail } from "@/lib/game";
import { PuzzlePanel } from "@/components/PuzzlePanel";
import { HintPanel } from "@/components/HintPanel";
import { RoomMedals } from "@/components/RoomMedals";
import { WindowBanner } from "@/components/WindowBanner";

export default async function ModulePage({ params }: PageProps<"/modules/[slug]">) {
  const { slug } = await params;
  const user = await requireUser();
  const mod = await getModuleDetail(user, slug);
  if (!mod) notFound();

  const timed = mod.opensAt !== null || mod.closesAt !== null;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard" className="text-xs text-ink-dim hover:text-ink">
          ← the map
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">{mod.title}</h1>
        <p className="mt-1 text-ink-dim">{mod.blurb}</p>
        {mod.clearRewardLabel && !mod.cleared && (
          <p className="mt-1 text-xs text-ink-dim">
            clear the whole room for: <span className="text-accent">{mod.clearRewardLabel}</span>
          </p>
        )}
      </div>

      {timed && !mod.cleared && (
        <WindowBanner opensAt={mod.opensAt} closesAt={mod.closesAt} locked={mod.locked} />
      )}

      {mod.locked && !timed ? (
        <p className="border border-signal/40 bg-signal/[0.06] px-4 py-3 text-sm text-signal">
          🔒 {mod.lockedReason}. You can read what&apos;s in here, but you can&apos;t crack it
          until it opens. Try the shop.
        </p>
      ) : mod.cleared ? (
        <p className="border border-verified/40 bg-verified/[0.06] px-4 py-3 text-sm text-verified">
          ✓ Room cleared. Loot&apos;s in your inventory.
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <div className="space-y-4">
          {mod.puzzles.map((p) => (
            <PuzzlePanel key={p.slug} puzzle={p} moduleLocked={mod.locked} />
          ))}
        </div>
        <div className="space-y-4">
          <RoomMedals medals={mod.medals} />
          <HintPanel hints={mod.hints} />
          <Link
            href="/market"
            className="block panel p-3 text-xs text-ink-dim hover:border-border-bright"
          >
            <span className="text-accent">the shop →</span> buy intel, forge keycards, cash in
            loot.
          </Link>
        </div>
      </div>
    </div>
  );
}
