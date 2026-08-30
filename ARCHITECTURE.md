# PSEUDO-BREACH — architecture & developer guide

Onboarding doc for anyone contributing to this codebase. Read the [README](../README.md) first
for what the product *is*; this is *how it's built*.

---

## 1. What it is, in one paragraph

A single **Next.js 16** app (frontend + backend in one deploy) that runs a CTF-style puzzle
"dungeon". Players log in with pre-issued credentials, crack rooms (puzzles), collect items,
trade at a shop NPC, and climb a live leaderboard. It's deployed on **Vercel** (serverless) with
**Postgres on Neon**; local dev uses **SQLite** so there's zero setup. There is no separate API
server, no separate frontend build — Next.js is the whole stack.

---

## 2. Tech stack

| Layer | Choice | Version | Notes |
|---|---|---|---|
| Runtime | Node.js | 24.x (≥ 20.9 required by Next 16) | |
| Framework | Next.js (App Router, Turbopack) | 16.3.3 | frontend + API + SSR in one |
| UI | React | 19.2 | Server Components by default |
| Language | TypeScript | 5.x | `strict: true` |
| Styling | Tailwind CSS | 4 (`@theme` in `globals.css`, no `tailwind.config`) | plus a few hand-rolled utility classes |
| ORM | Prisma | 6.19.3 (client + CLI pinned together) | |
| DB | SQLite (dev) → PostgreSQL/Neon (prod) | — | schema is written to be portable — see §4 |
| Auth | Auth.js / NextAuth | v5 (`5.0.0-beta.x`) | Credentials provider, JWT session cookie |
| Rate limiting | `@upstash/ratelimit` + `@upstash/redis` | — | **in-memory fallback** when Upstash env vars are unset (dev) |
| Validation | Zod | 4 | request bodies, login form |
| Markdown | `react-markdown` + `remark-gfm` + `rehype-sanitize` | — | puzzle prompts, NPC dialogue, announcements |
| Passwords | `bcryptjs` | 3 | pure-JS (works on serverless) |
| Tests | Vitest | 4 | unit; plus a DB-backed `selftest` script |
| Scripts | `tsx` | 4 | runs the `.ts` files in `scripts/` and `prisma/seed.ts` |
| Hosting | Vercel + GitHub (`Kappy-bara/pseudo-breach`) | — | auto-deploy on push to `main` |

**Not used** (removed): xterm.js (the terminal is a plain React component now), clsx, dotenv.

---

## 3. Repository layout

```
prisma/
  schema.prisma          the data model (single source of truth)
  seed.ts                ALL event content: items, shop trades, rooms, puzzles, hints, test users
  dev.db                 local SQLite file (git-ignored)

src/
  auth.ts                Auth.js config (providers, JWT/session callbacks)
  types/next-auth.d.ts   session/JWT type augmentation

  lib/                    ── backend logic, NO JSX ──
    db.ts                PrismaClient singleton (survives HMR)
    env.ts               centralised env access
    session.ts           getCurrentUser / requireUser / requireAdmin
    api.ts               route-handler helpers: json(), withUser(), limitOr429()
    ratelimit.ts         the rate limiters + in-memory fallback
    game.ts              READ models: room cards, room detail, leaderboard, item catalogue
    submit.ts            the answer-submission flow (validate → score → drop loot)
    scoring.ts           pure points math (base + rank bonus + speed bonus) + explainer text
    inventory.ts         grant / spend / hold items; getCreds
    trade.ts             the shop: list trades + executeTrade (atomic)
    flags.ts             per-user HMAC flags (CMINUS{...}) + sharing detection
    validators.ts        answer checking (static / regex / numeric / cminus-output)
    prompt.ts            {{placeholder}} substitution in puzzle prompts
    toolbox.ts           the `c-` decoder — runLine(), the verb dispatcher
    ciphers.ts           pure cipher/encoding helpers (shared by toolbox + prompt)
    admin.ts             all admin Server Actions
    json.ts              safe JSON.parse for the string-JSON columns

  components/             ── reusable UI ──
    Nav.tsx              top HUD (creds/points chips, links)
    ModuleCard.tsx       a room card on the dashboard
    PuzzlePanel.tsx      the answer box + result ("use client")
    HintPanel.tsx        the intel panel ("use client")
    TradeList.tsx        the shop's trade rows ("use client")
    Terminal.tsx         the toolkit console ("use client")
    Markdown.tsx         sanitised markdown renderer
    ItemChip.tsx         a coloured item pill
    LeaderboardLive.tsx  the polling leaderboard table ("use client")
    admin/EventPanel.tsx one event's full control panel

  app/
    layout.tsx           root: fonts, <html>/<body>, global CSS
    globals.css          Tailwind import + design tokens + utility classes
    page.tsx             landing (redirects to /dashboard if logged in)
    not-found.tsx        404
    login/               page + LoginForm ("use client") + actions.ts (server action)

    (app)/               ── route group: everything behind auth ──
      layout.tsx         calls requireUser(), renders <Nav>, fetches score+creds+rank
      dashboard/page.tsx the room grid + HUD
      modules/[slug]/    a room (puzzles + hints)
      market/page.tsx    the shop
      inventory/page.tsx the satchel
      leaderboard/page.tsx
      terminal/page.tsx  the toolkit
      demo/page.tsx      the "how it works" walkthrough

    admin/               ── requireAdmin() in its layout ──
      page.tsx           event control + live feeds
      users/             account table + password reset + item grants

    api/                 ── route handlers (pure backend endpoints) ──
      auth/[...nextauth]/route.ts   Auth.js handlers
      submit/route.ts               POST an answer
      hint/route.ts                 POST to unlock/buy a hint
      trade/route.ts                POST to execute a shop trade
      leaderboard/route.ts          GET the board (polled every 5s)

scripts/
  generate-accounts.ts   bulk-create participant logins → accounts.csv
  selftest.ts            end-to-end: a bot crawls the whole dungeon, asserts everything
  wipe-progress.ts       reset a leaderboard to zero (keeps accounts + content)

docs/
  ARCHITECTURE.md (this) · DEPLOY.md · runbook.md · toolbox.md
```

---

## 4. Data model (`prisma/schema.prisma`)

11 models. `Event` scopes everything — there are two events (`demo-session`, `pseudo-breach-main`)
and every module/user/item/npc belongs to one.

```
Event ─┬─< User ─┬─< Submission >─ Puzzle
       │         ├─< Solve >────── Puzzle
       │         ├─< InventoryEntry            (userId + itemKey + quantity)
       │         ├─< HintUnlock >── Hint
       │         └─< TradeExecution >── NpcTrade
       ├─< Module ─┬─< Puzzle ─< Hint
       │           └ prerequisiteItemsJson / clearRewardJson
       ├─< Item                                (the catalogue: cred, keycards, shards, loot, trophies)
       ├─< Npc ─< NpcTrade                      (the shop and its trades)
       └─< Announcement
AuditLog                                       (admin actions + anomaly flags; actorId → User?)
```

### Portability rule — **JSON is stored as `String`**

The schema uses **no enums, no scalar lists, no native `Json`** so the exact same file works on
both SQLite and Postgres. Anything structured is a `String` column holding JSON, parsed in app
code with `parseJson()` from `lib/json.ts`. Examples:

| column | shape |
|---|---|
| `Module.prerequisiteItemsJson` | `{ "keycard-red": 1 }` — items you must **hold** to enter |
| `Module.clearRewardJson` | `{ "cred": 20 }` — granted when every puzzle in the room is solved |
| `Puzzle.rewardsJson` | `{ "cred": 15, "frag-alpha": 1 }` — loot on solve |
| `Puzzle.validatorConfig` | `{ "answer": "..." }` / `{ "perUser": true }` / `{ "pattern": "..." }` / `{ "wrongCostCreds": 5 }` / `{ "leakInSource": true }` |
| `Hint.unlockRule` | `{ "kind": "free" \| "auto-after-wrong" \| "item" \| "buy" \| "npc", ... }` |
| `NpcTrade.giveJson` / `getItemsJson` / `showIfHoldsJson` | `{ itemKey: qty }` |

Switching to Postgres for production = change `datasource.provider` to `"postgresql"`, add
`directUrl`, `prisma migrate deploy`. That's it — see [DEPLOY.md](DEPLOY.md).

### Key invariants

- A `Puzzle.slug` is globally unique (not scoped to event) — keep them distinct.
- `Solve` is `@@unique([userId, puzzleId])` — a puzzle is solved at most once per user.
- `InventoryEntry` is `@@unique([userId, itemKey])` — one row per item, `quantity` is the count.
  `cred` is just an item with key `"cred"`; `getCreds()` reads its quantity.
- Points (leaderboard) come **only** from `Solve.basePts + bonusPts`. Creds and hint costs never
  touch the score.

---

## 5. How a request flows

### Rendering (a page)
1. Browser hits `/modules/lobby`.
2. `(app)/layout.tsx` (Server Component) runs `requireUser()` → redirect to `/login` if no session.
3. `modules/[slug]/page.tsx` (Server Component) calls `getModuleDetail(user, slug)` in `lib/game.ts`,
   which hits Prisma directly and returns a plain view object (prompt markdown is rendered
   per-user here via `renderPrompt`).
4. Server sends finished HTML. The interactive bits (`<PuzzlePanel>`, `<HintPanel>`) are
   `"use client"` — their JS ships to the browser.

### Mutation (submitting an answer)
1. `<PuzzlePanel>` (browser) `fetch("POST /api/submit", { puzzleSlug, value })`.
2. `api/submit/route.ts` → `withUser()` wrapper (401 if not logged in) → `limitOr429()`
   (rate limit: 5/10s per user, 20/10s per IP) → `submitAnswer()` in `lib/submit.ts`.
3. `submitAnswer`: check event is open → check already-solved → check cooldown → `validateSubmission()`
   → write `Submission` → if correct: `scoreSolve()` → write `Solve` → `grantItems()` (puzzle
   loot + first-blood creds + room-clear reward). If a **per-user flag** was submitted by the
   wrong user, log `flag-owner-mismatch` to `AuditLog`.
4. Response JSON → `<PuzzlePanel>` shows the result, calls `router.refresh()` to repaint the
   server-rendered parts.

### Server Actions (login, all of admin)
Forms `action={serverFunction}` where the function is `"use server"`. No hand-written API route.
- `login/actions.ts` → `authenticate()` → rate-limit by IP → `signIn("credentials", ...)`.
- `lib/admin.ts` → every action starts with `requireAdmin()`, mutates, writes an `AuditLog`
  row, and `revalidatePath()`s the affected pages.

### The leaderboard
`getLeaderboard()` has a **3-second in-process cache** (`BOARD_TTL_MS` in `lib/game.ts`).
`LeaderboardLive` polls `GET /api/leaderboard` every 5s. No websockets (Vercel serverless).

---

## 6. Subsystems

### Auth (`src/auth.ts`, `lib/session.ts`)
Credentials provider, JWT strategy, 12-hour session. `authorize()` looks up by `registerId`,
`bcrypt.compare`, rejects locked users. `jwt`/`session` callbacks copy `id`, `role`, `registerId`,
`eventId` onto the session. **Every page/route re-hydrates the user from the DB** via
`getCurrentUser()` so `isLocked`/`role` are always current — the JWT is not trusted for authz.

### The economy (`lib/inventory.ts`, `lib/trade.ts`)
- `grantItems` / `spendItems` operate on `InventoryEntry`. `spendItems` uses an atomic
  `updateMany({ where: { quantity: { gte: n } } })` guard so two concurrent spends can't both win.
- `executeTrade` wraps the whole check→spend→grant→record in `prisma.$transaction`.
- Keycards are **held, not spent**, to enter a gated room; the one exception is the shop's
  "open THE CORE" trade, which consumes 3 keycards for a `keycard-master`. Because keycards get
  consumed there, `moduleLockReason()` treats any **cleared** room as permanently unlocked.

### Anti-cheat: per-user flags (`lib/flags.ts`, `lib/prompt.ts`)
Puzzles with `perUserFlag: true` don't have a fixed answer. The flag is
`CMINUS{ base32(hmac_sha256(FLAG_SECRET, userId + ":" + puzzleSlug))[:16] }`. The prompt bakes in
a per-user ciphertext via `{{flagCaesar3}}` / `{{flagB64}}` etc. If user B submits user A's flag,
`submit.ts` recomputes and logs the mismatch to `AuditLog` → shows in `/admin`. Only two puzzles
use this today (`reception-caesar`, `core-final`).

### The `c-` toolbox (`lib/toolbox.ts`, `lib/ciphers.ts`)
Not a language — `runLine(line): Promise<{ok, out}>` is a verb dispatcher (`caesar`, `unbase64`,
`reverse`, `morse`, `hash`, …) with deliberately rude error messages. Runs **100% client-side**,
no server calls, can't hang. See [toolbox.md](toolbox.md).

### Rate limiting (`lib/ratelimit.ts`)
`@upstash/ratelimit` sliding windows. **If `UPSTASH_REDIS_REST_URL`/`_TOKEN` are unset it falls
back to a per-process in-memory limiter** — fine for local dev, **not** global on serverless, so
Upstash must be configured for the real event.

---

## 7. Conventions

- **Server Component by default.** Add `"use client"` only for interactivity (state, effects,
  event handlers, `fetch`).
- **`lib/` has no JSX.** UI lives in `components/` and `app/`.
- **Read models in `lib/game.ts`** return plain serialisable objects, never Prisma models with
  methods, so they can cross the server→client boundary.
- **Content is data, not code.** New rooms/puzzles/items/trades → edit `prisma/seed.ts`, run
  `npm run db:seed` (upserts by slug; hints are delete-and-recreate).
- **Next.js 16 specifics:** `params`/`searchParams`/`cookies()`/`headers()` are **async** —
  always `await`. Page/layout prop types use the generated `PageProps<'/route'>` /
  `LayoutProps<'/'>` (run `npx next typegen` after adding routes). Route-group layouts only
  accept `LayoutProps<'/'>`.
- **Money/qty maths** goes through `lib/scoring.ts` (points) or `lib/inventory.ts` (items) — both
  unit-tested. Don't inline it.
- Tailwind 4: tokens live in `@theme` in `globals.css`; reusable bits are the `.panel`, `.btn`,
  `.hud-chip`, `.kicker` classes there.

---

## 8. Local development

```bash
npm install
cp .env.example .env          # set AUTH_SECRET + FLAG_SECRET to any 32+ random chars
npm run db:reset              # create sqlite db + seed both events + test users
npm run dev                   # http://localhost:3000
```

Seeded logins: `PB-DEMO-01` / `demo-pass-01` · `PB-MAIN-01` / `main-pass-01` · `ADMIN001` /
`admin-pass-2026`.

| command | does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run test` | Vitest (scoring, toolbox, flags, inventory) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run selftest` | DB-backed end-to-end crawl of the main dungeon — run before shipping content |
| `npm run db:seed` / `db:reset` / `db:wipe` / `db:studio` | Prisma / seed / leaderboard-reset / GUI |
| `npm run accounts -- --count 120 --event pseudo-breach-main` | bulk logins → `accounts.csv` |

### Env vars

| var | dev | prod |
|---|---|---|
| `DATABASE_URL` | `file:./dev.db` | Neon **pooled** connection string |
| `DIRECT_URL` | — | Neon **direct** string (migrations only) |
| `AUTH_SECRET` | any 32+ chars | `openssl rand -hex 32` |
| `FLAG_SECRET` | any 32+ chars | random, **constant for the whole event** (flags derive from it) |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | optional (in-memory fallback) | **required** |
| `NEXT_PUBLIC_ACTIVE_EVENT` | `demo-session` | `pseudo-breach-main` (landing-page card only) |

---

## 9. Gotchas / things that bit us

- **npm 11 blocks postinstall scripts.** Prisma/esbuild need theirs — they're allow-listed in
  `package.json#allowScripts`. After adding a dep with a build step: `npm approve-scripts <pkg>`.
- **PowerShell execution policy** blocks `npm.ps1`. Fix once:
  `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`. Or use Git Bash / `npm.cmd`.
- **`prisma db push --force-reset`** is guarded (asks for consent). For a clean local reset just
  delete `prisma/dev.db` and `npm run db:push && npm run db:seed` (that's what `db:reset` does).
- **`tsx` scripts can't use top-level `await`** in the default CJS mode — wrap in `async function main()`.
- **The seed upserts by slug** and does NOT delete removed content. If you rename a slug, the old
  row lingers — do a full `db:reset` after renames.
- **`next build` + `next dev` share `.next/`** loosely; if a build fails with `EBUSY`, stop the
  dev server first.
- Nav renders a `signOut` form; scripted "click the first form" in tests logs you out. Target forms
  specifically.

---

## 10. Deploying

Full steps in [DEPLOY.md](DEPLOY.md). Summary: Neon + Upstash + Vercel (all free tier), flip
`schema.prisma` provider to `postgresql`, set env vars, `prisma migrate deploy`, `db:seed` once,
keep `pseudo-breach-main` at `status: "draft"` until go-live (flip it from `/admin`).
Event-day procedures: [runbook.md](runbook.md).
