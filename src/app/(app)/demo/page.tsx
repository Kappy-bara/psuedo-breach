import Link from "next/link";
import { requireUser } from "@/lib/session";

const steps = [
  {
    t: "1 · Log in",
    d: "You got a register ID (like PB-1234-07) and a password. That's it — no sign-up, no email. If it doesn't work, tell an organiser.",
  },
  {
    t: "2 · Read the dashboard",
    d: "Your name, your score, your rank, and a grid of modules. Green = cleared, 🔒 = locked (you need a token from another module first).",
  },
  {
    t: "3 · Open a module",
    d: "Each module has one or more puzzles. Read the prompt, work out the answer, paste it in the box. Wrong answers only cost a few seconds of cooldown — guessing is fine.",
  },
  {
    t: "4 · Flags look like this",
    d: "CMINUS{some_text}. Submit the whole thing, braces included. Some flags are personalised to you — don't bother copying someone else's, it won't work and we'll see it.",
  },
  {
    t: "5 · Use the terminal",
    d: "The /terminal page runs c-, our toy language. It does ciphers, encodings and hashes for you. Type `help` and `spec`. `connect <module>` then `probe()` pulls data a module won't show on its page; `knock(<module>, <key>)` tries a key.",
  },
  {
    t: "6 · Hints",
    d: "Every module has hints. Some are free, some unlock after a few wrong tries, some need a token you earned elsewhere. A few hints are only reachable from the terminal.",
  },
  {
    t: "7 · Scoring",
    d: "base points + a rank bonus (bigger if you solve it early) + a speed bonus (bigger if you solve it soon after it opens). The leaderboard is live.",
  },
];

export default async function DemoPage() {
  await requireUser();
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">How PSEUDO-BREACH works</h1>
        <p className="mt-1 text-sm text-ink-dim">
          This is the practice run. Nothing here counts toward the real event. Poke at
          everything.
        </p>
      </div>

      {/* drop the real intro video in here before the demo session */}
      <div className="flex aspect-video items-center justify-center border border-dashed border-border bg-panel/40 text-sm text-ink-dim">
        [ intro video goes here — embed before the demo session ]
      </div>

      <ol className="space-y-3">
        {steps.map((s) => (
          <li key={s.t} className="border border-border bg-panel/60 p-4">
            <div className="font-bold text-accent">{s.t}</div>
            <p className="mt-1 text-sm text-ink-dim">{s.d}</p>
          </li>
        ))}
      </ol>

      <div className="flex gap-3">
        <Link
          href="/dashboard"
          className="border border-accent px-5 py-2 font-bold text-accent hover:bg-accent hover:text-bg transition-colors"
        >
          start the practice modules →
        </Link>
        <Link
          href="/terminal"
          className="border border-border px-5 py-2 text-ink-dim hover:border-ink-dim"
        >
          try the terminal
        </Link>
      </div>
    </div>
  );
}
