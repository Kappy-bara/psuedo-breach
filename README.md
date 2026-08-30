# PSEUDO-BREACH

A hacking-themed puzzle **dungeon** for a college event. Players log in with issued
credentials and break into **THE STACK** — a dead server complex — laid out as an **open-world
map**. Some rooms are open from the start, some need a keycard, some open only inside a **time
window** ("come between 19:00 and 19:30"). Rooms are puzzles built for first-years (observation,
logic, one-step ciphers, cross-room trails). Cracking one drops **loot**: creds 💰, shards 🧩,
keycards 🔑, junk 💾, trophies 🏆. **The Shop** trades: forge 3 shards into a keycard, buy a tip,
cash in junk, open the final vault. A live **activity feed** broadcasts every solve and
first blood; the first three into a room get 🥇🥈🥉; **achievements** hand out titles; a live
leaderboard ranks players by **points** (from solves only) with a **year-wise team board**
alongside. `c-` is a tiny **decoder toolbox** — type a verb, get an answer.

Not real hacking — every "hack" is a self-contained puzzle.

- Event: 16 September 2026, 18:00–23:59 IST · online · demo/practice run a few days earlier
- Stack: Next.js 16 (App Router) · Prisma · SQLite (dev) / Postgres-Neon (prod) · Auth.js ·
  Upstash rate-limiting · Vercel
- Look: "Operator's blueprint" — drafting-ink navy, blueprint-blue lines, Chakra Petch / IBM
  Plex Sans / JetBrains Mono. Single-theme dark, all tokens in `globals.css`.

## Quick start

```bash
npm install
cp .env.example .env        # fill AUTH_SECRET and FLAG_SECRET (any 32+ random chars for dev)
npm run db:reset            # sqlite db + seed the two events
npm run dev                 # http://localhost:3000
```

Seeded logins:

| register id  | password          | where |
|--------------|-------------------|-------|
| `PB-DEMO-01` | `demo-pass-01`    | practice run (4 rooms, incl. a recurring time room) |
| `PB-MAIN-01` | `main-pass-01`    | main event (10 rooms + 2 timed bonus rooms, `status: draft` until go-live) |
| `ADMIN001`   | `admin-pass-2026` | admin (`/admin`) |

## Scripts

| command | does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run test` | Vitest — scoring, `c-` toolbox, per-user flags, inventory, unlock engine, achievements |
| `npm run selftest` | end-to-end: a bot crawls the dungeon, forges keycards, hits a timed room; asserts every gate, medal, feed row, achievement + cred reward, the year board, and the anti-share log |
| `npm run lint` / `typecheck` | `eslint` / `tsc --noEmit` |
| `npm run db:push` / `db:seed` / `db:reset` / `db:wipe` / `db:studio` | Prisma / seed / progress-reset |
| `npm run accounts -- --count 120 --event pseudo-breach-main` | bulk-create accounts → `accounts.csv` |

## Map

```
src/
  auth.ts                 Auth.js (credentials, pre-issued accounts)
  lib/
    game.ts               room cards / room detail / leaderboard / year board / medals
    unlock.ts             pure open-world unlock engine (open / item / prereq / time windows)
    submit.ts             answer flow: unlock check → validate → score → loot → feed → achievements
    inventory.ts          grant / spend / hold items; getCreds
    trade.ts              the Shop: list + execute trades (atomic $transaction) + forge feed
    feed.ts               live activity feed — emitFeed (fire-and-forget) / getFeed
    achievements.ts       catalog eval, cred + title rewards, evaluateAchRule (pure)
    scoring.ts            pure base + rank-bonus + speed-bonus (unit tested)
    flags.ts              per-user HMAC flags  CMINUS{...}  + sharing detection
    confetti.ts           tiny canvas burst, no dependency
    toolbox.ts / ciphers.ts   the c- decoder + pure cipher helpers
    ratelimit.ts          Upstash sliding window (in-memory fallback for local dev)
  app/
    (app)/                logged-in pages: dashboard (map / list), modules/[slug], market,
                          inventory, leaderboard, achievements, terminal, demo
    admin/                event control, schedule, room unlock-rule editor, feeds, users
    api/                  submit · hint · trade · leaderboard · feed
prisma/
  schema.prisma           portable schema (no enums / arrays / native json)
  seed.ts                 items, the Shop + trades, 10 main rooms + 2 timed bonus + 4 demo, achievements, users
docs/
  ARCHITECTURE.md         stack, data model, request flows, conventions — start here if contributing
  toolbox.md              the c- command reference
  DEPLOY.md               Neon + Vercel + go-live
  runbook.md              what to do when something breaks during the event
```

**Contributing?** Read [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## The economy (main event)

- **points** — leaderboard rank. From solves only. Never spent. Achievements don't touch it.
- **creds** — a wallet. Loot drops + first blood + achievement rewards. Spent at the Shop (tips,
  forging, buy-backs). A couple of rooms charge a small cred toll for wrong guesses (they warn you).
- **shards** → 3 of a set → 1 keycard, forged at the Shop. `frag-alpha` → Red, `frag-beta` → Black.
- **keycards** — held (not spent) to enter gated rooms. Red+Green+Black → Shop → Master → **THE CORE**.
- **titles** — the highest-priority achievement you hold shows next to your name.

Room layout, map coordinates, unlock rules, loot tables and the achievement catalog are all in
[`prisma/seed.ts`](prisma/seed.ts) — edit there, `npm run db:seed`. Unlock rules are also
editable per-room from `/admin` during the event.

## Deploying

See [`docs/DEPLOY.md`](docs/DEPLOY.md). Create a free Neon Postgres project, flip
`datasource.provider` to `postgresql`, set env vars on Vercel, `prisma migrate deploy`, seed
once, keep the main event `status: "draft"` until 18:00 on event day.
