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
      <p className="kicker text-accent">{"// unauthorized access detected"}</p>
      <h1 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">
        PSEUDO<span className="text-ink-dim">·</span>BREACH
      </h1>
      <p className="mt-4 max-w-xl text-ink-dim">
        You&apos;re breaking into <span className="text-ink">THE STACK</span> — a dead darknet
        server complex, one locked room at a time. Every room is a puzzle. Crack it, grab the
        loot, go deeper.
      </p>
      <p className="mt-2 max-w-xl text-sm text-ink-dim">
        Rooms drop <span className="text-signal">creds</span>,{" "}
        <span className="text-accent-magenta">fragments</span> and{" "}
        <span className="text-accent">keycards</span>. The one working{" "}
        <span className="text-ink">Shop</span> left in the building trades them — forge a keycard,
        buy a tip, cash in junk. Points climb a live leaderboard.
      </p>
      <p className="mt-2 text-sm text-ink-dim">
        Not real hacking. Nothing here touches a real system. It&apos;s a dungeon in a hoodie.
      </p>

      <Link href="/login" className="btn mt-8">
        [ jack in → ]
      </Link>

      {event && (
        <div className="panel mt-10 p-5 text-sm">
          <div className="font-display font-bold text-ink">{event.name}</div>
          <div className="mt-1 font-mono text-xs text-ink-dim">
            {new Date(event.startsAt).toUTCString()} — {new Date(event.endsAt).toUTCString()}
          </div>
          <div className="mt-1 text-ink-dim">
            status: <span className="text-accent">{event.status}</span>
          </div>
        </div>
      )}

      <section className="mt-12">
        <h2 className="kicker">{"// the rules"}</h2>
        <ol className="mt-3 space-y-2 text-sm text-ink-dim">
          <li>1. We give you a register ID and a password. No sign-ups.</li>
          <li>2. Crack rooms. Some rooms are locked until you carry the right keycard.</li>
          <li>3. Wrong answers are basically free (a couple of rooms charge a small cred toll — they say so). AI tools are allowed.</li>
          <li>
            4. <span className="text-danger">Don&apos;t</span> try to crash or flood the
            site. That&apos;s the one thing that gets you booted.
          </li>
        </ol>
      </section>

      <section className="mt-10">
        <h2 className="kicker">{"// points & creds"}</h2>
        <Markdown className="mt-3 text-ink-dim">{SCORING_EXPLAINER}</Markdown>
      </section>
    </div>
  );
}
