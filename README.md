# PSEUDO-BREACH

A hacking-themed puzzle **dungeon** for a college event. Players log in with issued
credentials and break into **THE STACK** — a dead server complex — one locked room at a time.
Rooms are puzzles built for first-years (observation, logic, one-step ciphers, cross-room
trails). Cracking a room drops **loot**: creds 💰, shards 🧩, keycards 🔑, junk 💾, trophies 🏆.
A vendor daemon, **SUDO**, trades: forge 3 shards into a keycard, buy a tip, cash in junk,
open the final vault. A live leaderboard ranks players by **points** (from solves only).
`c-` is a tiny **decoder toolbox** — type a verb, get an answer. Not a real language, on purpose.

Not real hacking — every "hack" is a self-contained puzzle.

- Event: 16 September 2026, 18:00–23:59 IST · online · demo/practice run a few days earlier
- Stack: Next.js 16 (App Router) · Prisma · SQLite (dev) / Postgres-Neon (prod) · Auth.js ·
  Upstash rate-limiting · Vercel

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
| `PB-DEMO-01` | `demo-pass-01`    | practice run (3 rooms) |
| `PB-MAIN-01` | `main-pass-01`    | main event (8 rooms, `status: draft` until go-live) |
| `ADMIN001`   | `admin-pass-2026` | admin (`/admin`) |

## Scripts

| command | does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run test` | Vitest — scoring, the `c-` toolbox, per-user flags, inventory math |
| `npm run selftest` | end-to-end: a bot crawls the whole dungeon, forges keycards, opens THE CORE; asserts every gate, loot drop, cred toll and anti-share log |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:push` / `db:seed` / `db:reset` / `db:studio` | Prisma / seed |
| `npm run accounts -- --count 120 --event pseudo-breach-main` | bulk-create accounts → `accounts.csv` |

## Map

```
src/
  auth.ts                 Auth.js (credentials, pre-issued accounts)
  lib/
    game.ts               room / leaderboard / hint read-models
    submit.ts             answer flow: validate → score → drop loot → sharing check
    inventory.ts          grant / spend / hold items; getCreds
    trade.ts              SUDO: list + execute trades (atomic $transaction)
    scoring.ts            pure base + rank-bonus + speed-bonus (unit tested)
    flags.ts              per-user HMAC flags  CMINUS{...}  + sharing detection
    validators.ts         static / regex / numeric answer checks
    prompt.ts             {{placeholder}} substitution — per-user ciphertext in prompts
    toolbox.ts            the c- decoder (runLine) — verb dispatcher, funny errors
    ciphers.ts            pure cipher/encoding helpers (shared by toolbox + prompt)
    ratelimit.ts          Upstash sliding window (in-memory fallback for local dev)
  app/
    (app)/                logged-in pages: dashboard, modules/[slug], market (SUDO),
                          inventory, leaderboard, terminal (toolkit), demo
    admin/                event control, announcements, users, grant-item, feeds
    api/                  submit · hint · trade · leaderboard
prisma/
  schema.prisma           portable schema (no enums / arrays / native json)
  seed.ts                 items, SUDO + trades, 8 dungeon rooms + 3 demo rooms, test users
docs/
  toolbox.md              the c- command reference
  DEPLOY.md               Neon + Vercel + go-live
  runbook.md              what to do when something breaks during the event
```

## The economy (main event)

- **points** — leaderboard rank. From solves only. Never spent.
- **creds** — a wallet. Loot drops + first blood. Spent at SUDO (tips, forging, buy-backs).
  A couple of rooms charge a small cred toll for wrong guesses (they warn you).
- **shards** → 3 of a set → 1 keycard, forged at SUDO. `frag-alpha` → Red, `frag-beta` → Black.
- **keycards** — held (not spent) to enter gated rooms. Blue (R1→R3), Red (forge→R4),
  Green (R4→R6), Black (forge). Red+Green+Black → SUDO → Master → **R7 THE CORE**.

Room lineup, gating and loot tables are all in [`prisma/seed.ts`](prisma/seed.ts) — edit there,
`npm run db:seed`.

## Deploying

See [`docs/DEPLOY.md`](docs/DEPLOY.md). Create a free Neon Postgres project, flip
`datasource.provider` to `postgresql`, set env vars on Vercel, `prisma migrate deploy`, seed
once, keep the main event `status: "draft"` until 18:00 on event day.
