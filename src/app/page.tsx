import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getEventBySlug } from "@/lib/game";
import { env } from "@/lib/env";
import { SCORING_EXPLAINER } from "@/lib/scoring";
import { Markdown } from "@/components/Markdown";

export default async function Landing() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  const event = await getEventBySlug(env.activeEvent());

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-5 py-16">
      <p className="text-accent text-xs tracking-[0.3em]">// INCOMING TRANSMISSION</p>
      <h1 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">
        PSEUDO<span className="text-ink-dim">·</span>BREACH
      </h1>
      <p className="mt-4 max-w-xl text-ink-dim">
        A sandbox full of locked modules. Each one is a puzzle. Crack it, score points,
        climb a live leaderboard. There is a terminal that speaks a language called{" "}
        <span className="text-accent-cyan">c-</span> and it will help you if you ask nicely.
      </p>
      <p className="mt-2 text-sm text-ink-dim">
        This is <span className="text-ink">not</span> real hacking. Nothing here touches a
        real system. It&apos;s puzzles with a hoodie on.
      </p>

      <Link
        href="/login"
        className="mt-8 inline-block border border-accent px-6 py-2.5 font-bold text-accent hover:bg-accent hover:text-bg transition-colors"
      >
        [ enter your credentials → ]
      </Link>

      {event && (
        <div className="mt-10 border border-border bg-panel/60 p-5 text-sm">
          <div className="text-ink">{event.name}</div>
          <div className="mt-1 text-ink-dim">
            {new Date(event.startsAt).toUTCString()} — {new Date(event.endsAt).toUTCString()}
          </div>
          <div className="mt-1 text-ink-dim">
            status: <span className="text-accent">{event.status}</span>
          </div>
        </div>
      )}

      <section className="mt-12">
        <h2 className="text-sm tracking-[0.2em] text-ink-dim">// THE RULES</h2>
        <ol className="mt-3 space-y-2 text-sm text-ink-dim">
          <li>1. You get a register ID and a password. We hand those out. No sign-ups.</li>
          <li>2. Solve puzzles inside modules. Some modules are locked until you hold a token from another.</li>
          <li>3. Wrong answers cost nothing but a few seconds of cooldown. AI tools are allowed.</li>
          <li>
            4. <span className="text-accent-red">Do not</span> try to crash or flood the
            site. That&apos;s the only thing that gets you removed.
          </li>
        </ol>
      </section>

      <section className="mt-10">
        <h2 className="text-sm tracking-[0.2em] text-ink-dim">// SCORING</h2>
        <Markdown className="mt-3 text-ink-dim">{SCORING_EXPLAINER}</Markdown>
      </section>
    </div>
  );
}
