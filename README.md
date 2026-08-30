# PSEUDO-BREACH

A CTF-style puzzle platform for a college event. Participants log in with issued
credentials, crack **modules** made of puzzles, earn points on a live leaderboard,
and use a browser terminal that runs **`c-`** ("c-minus"), a tiny toy language that
dispenses hints. Not real hacking — every challenge is a self-contained puzzle.

- Event: 16 September 2026, 18:00–23:59 IST · online
- Demo/practice session a few days before
- Stack: Next.js 16 (App Router) · Prisma · SQLite (dev) / Postgres-Neon (prod) ·
  Auth.js · Upstash rate-limiting · Vercel

## Quick start (local)

```bash
npm install
cp .env.example .env        # fill AUTH_SECRET and FLAG_SECRET (any 32+ random chars for dev)
npm run db:reset            # create sqlite db, push schema, seed demo + main events
npm run dev                 # http://localhost:3000
```

Seeded test logins:

| register id  | password        | where |
|--------------|-----------------|-------|
| `PB-DEMO-01` | `demo-pass-01`  | demo event |
| `PB-MAIN-01` | `main-pass-01`  | main event |
| `ADMIN001`   | `admin-pass-2026` | admin (`/admin`) |

## Scripts

| command | does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run test` | Vitest — scoring, `c-` interpreter, per-user flags |
| `npm run selftest` | end-to-end: a bot solves the whole main event, asserts tokens/gating/anti-share |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:push` / `db:seed` / `db:reset` / `db:studio` | Prisma / seed |
| `npm run accounts -- --count 120 --event pseudo-breach-main` | bulk-create accounts → `accounts.csv` |

## How it fits together

```
src/
  auth.ts                 Auth.js (credentials, pre-issued accounts)
  lib/
    game.ts               module/leaderboard/token/hint read models
    submit.ts             answer flow: validate → score → grant token → sharing check
    scoring.ts            pure base + rank-bonus + speed-bonus (unit tested)
    flags.ts              per-user HMAC flags  CMINUS{...}  + sharing detection
    validators.ts         static / regex / numeric / cminus-output answer checks
    prompt.ts             {{placeholder}} substitution — bakes a per-user ciphertext into prompts
    ratelimit.ts          Upstash sliding window (in-memory fallback for local dev)
    cminus/               the c- language: lexer → parser → interpreter → builtins
      spec.md             the language cheat-sheet
      worker.ts           runs c- in a Web Worker (can't freeze or DoS anything)
  content/
    probes.ts             what probe("<module>") returns per user
  app/
    (app)/                authed pages: dashboard, modules/[slug], terminal, leaderboard, demo
    admin/                event control, announcements, users, anomaly feed
    api/                  submit · hint · terminal (bridge) · leaderboard
prisma/
  schema.prisma           portable schema (no enums / arrays / native json)
  seed.ts                 demo (3 modules) + main (8 modules) content + test users
docs/
  DEPLOY.md               Neon + Vercel + go-live
  runbook.md              what to do when something breaks during the event
```

## Content

Puzzles, hints and the cross-module token graph live in [`prisma/seed.ts`](prisma/seed.ts).
Editing content = edit the seed, `npm run db:seed` (idempotent). The `c-` terminal
data dumps are in [`src/content/probes.ts`](src/content/probes.ts) — keep the two in sync.

Token graph (main event): `caesars-ghost → ghost-key`, `boot-camp → compiler-pass`,
`signal-noise → siren-key`; `signal-noise` needs `ghost-key`, `compilers-curse` needs
`compiler-pass`, `the-vault` needs all three.

## Deploying

See [`docs/DEPLOY.md`](docs/DEPLOY.md). Short version: create a Neon Postgres project,
flip `datasource.provider` to `postgresql`, set env vars on Vercel, `prisma migrate deploy`,
seed once, keep the main event `status: "draft"` until 18:00 on event day.
