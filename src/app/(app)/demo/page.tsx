import Link from "next/link";
import { requireUser } from "@/lib/session";

const steps = [
  {
    t: "1 · Jack in",
    d: "You got a register ID (like PB-1234-07) and a password. That's it. If it doesn't work, grab an organiser.",
  },
  {
    t: "2 · Read THE STACK",
    d: "The dashboard is a map of rooms. Green = cleared, 🔒 = locked (you're missing a keycard). Your satchel (creds + loot) is in the corner and up in the nav.",
  },
  {
    t: "3 · Crack a room",
    d: "Open a room, read the prompt, find the answer, paste it in the box. Flags look like CMINUS{something}. Wrong guesses just cost a few seconds — a couple of rooms charge a tiny cred toll and they warn you.",
  },
  {
    t: "4 · Grab the loot",
    d: "Cracking a room drops stuff: creds 💰, fragments 🧩, keycards 🔑, or random junk 💾. It lands in your satchel automatically. Clearing every puzzle in a room can drop a bonus.",
  },
  {
    t: "5 · Visit SUDO",
    d: "SUDO is a daemon that trades. Bring 3 matching fragments → get a keycard. Spend creds → buy a tip or a keycard. Sell junk you don't need. Some locked rooms only open once SUDO hands you the right keycard.",
  },
  {
    t: "6 · Keycards open doors",
    d: "Carry a keycard and the matching room unlocks — you don't spend it just to walk in. THE CORE at the end needs three keycards handed to SUDO.",
  },
  {
    t: "7 · The toolkit (optional)",
    d: "The 'toolkit' page runs c-, a tiny decoder. Type a verb: caesar \"text\" all, unbase64 \"...\", reverse \"...\". No room needs it — it just saves you doing a cipher by hand.",
  },
  {
    t: "8 · Two numbers",
    d: "Points = your leaderboard rank, from cracking rooms. Creds = a wallet you spend at SUDO. Spending creds never changes your rank. The board is live.",
  },
];

export default async function DemoPage() {
  await requireUser();
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">How PSEUDO-BREACH works</h1>
        <p className="mt-1 text-sm text-ink-dim">
          Practice run. Nothing here counts. Break everything.
        </p>
      </div>

      {/* drop the real intro video in here before the demo session */}
      <div className="flex aspect-video items-center justify-center border border-dashed border-border bg-panel/40 text-sm text-ink-dim">
        [ intro video goes here — embed before the demo session ]
      </div>

      <ol className="space-y-3">
        {steps.map((s) => (
          <li key={s.t} className="panel p-4">
            <div className="font-bold text-accent">{s.t}</div>
            <p className="mt-1 text-sm text-ink-dim">{s.d}</p>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/dashboard"
          className="border border-accent px-5 py-2 font-bold text-accent transition-colors hover:bg-accent hover:text-bg"
        >
          into the practice rooms →
        </Link>
        <Link
          href="/market"
          className="border border-border px-5 py-2 text-ink-dim hover:border-ink-dim"
        >
          meet SUDO
        </Link>
      </div>
    </div>
  );
}
