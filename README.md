# 👾 PSEUDO-BREACH

> A hacking-themed puzzle **dungeon** for a college event.

Players log in with issued credentials and break into **THE STACK** — a dead server complex — laid out as an **open-world map**. Some rooms are open from the start, some need a keycard, some open only inside a **time window** ("come between 19:00 and 19:30"). 

Rooms are puzzles built for first-years (observation, logic, one-step ciphers, cross-room trails). Cracking one drops **loot**: creds 💰, shards 🧩, keycards 🔑, junk 💾, and trophies 🏆. 

- **The Shop**: Trade and forge 3 shards into a keycard, buy a tip, cash in junk, or open the final vault. 
- **Activity Feed**: A live feed broadcasts every solve and first blood; the first three into a room get 🥇🥈🥉.
- **Leaderboards**: A live leaderboard ranks players by **points** with a **year-wise team board** alongside. 
- **`c-` Toolbox**: A tiny in-game terminal decoder — type a verb, get an answer.

> [!NOTE]
> **Not real hacking** — every "hack" is a self-contained puzzle.

- **Stack**: Next.js 16 (App Router) · Prisma · SQLite (dev) / Postgres (prod) · Auth.js
- **Design**: "Operator's blueprint" — drafting-ink navy, blueprint-blue lines, Chakra Petch / IBM Plex Sans / JetBrains Mono. Single-theme dark, all tokens in `globals.css`.

---

## 🚀 Quick Start

```bash
npm install
cp .env.example .env        # fill AUTH_SECRET and FLAG_SECRET (any random chars for dev)
npm run db:reset            # sqlite db + seed the two events
npm run dev                 # http://localhost:3000
```

### Seeded Logins:

| Register ID | Password | Access |
|---|---|---|
| `PB-DEMO-01` | `demo-pass-01` | Practice run (4 rooms, incl. a recurring time room) |
| `PB-MAIN-01` | `main-pass-01` | Main event (10 rooms + 2 timed bonus rooms) |
| `ADMIN001` | `admin-pass-2026` | Admin Dashboard (`/admin`) |

---

## 🕹️ The Arcade (Mini-Games)

Alongside the main dungeon, players can earn bonus points and creds by visiting the **Arcade** and beating UI-based mini-games:
- **Memory Match**: Find matching hardware emoji pairs.
- **Terminal Snake**: Classic snake canvas game.
- **Security Override (Simon Says)**: Memorize and repeat a sequence of flashes.
- **Tic-Tac-Toe**: Beat a basic AI.
- **Firewall Sweeper (Minesweeper)**: Clear a grid of viruses.
- **Rock Paper Scissors** & **Dino Jumper** & **Sudoku**.

Winning these games provides players with a hidden `CMINUS{...}` flag to submit for points.

---

## 🛠️ Scripts

| Command | Description |
|---|---|
| `npm run dev` / `build` / `start` | Run the Next.js application |
| `npm run test` | Vitest — scoring, `c-` toolbox, per-user flags, inventory, unlock engine |
| `npm run selftest` | End-to-end bot crawl: asserts every gate, medal, feed row, and anti-share log |
| `npm run lint` / `typecheck` | `eslint` / `tsc --noEmit` |
| `npm run db:push` / `db:seed` / `db:reset` | Prisma schema push / seed / progress-reset |

---

## 📂 Architecture Map

```text
src/
  auth.ts                 Auth.js (credentials, pre-issued accounts)
  lib/
    game.ts               room cards / room detail / leaderboard / medals
    unlock.ts             open-world unlock engine (open / item / prereq / time)
    submit.ts             answer flow: unlock check → validate → score → loot
    inventory.ts          grant / spend / hold items; getCreds
    trade.ts              the Shop: list + execute trades + forge feed
    feed.ts               live activity feed
    achievements.ts       catalog eval, cred + title rewards
    scoring.ts            pure base + rank-bonus + speed-bonus
    flags.ts              per-user HMAC flags CMINUS{...} + sharing detection
  components/arcade/      Arcade mini-games (Snake, Minesweeper, etc.)
  app/
    (app)/                logged-in pages: dashboard, modules, market, arcade, terminal
    admin/                event control, schedule, room unlock-rule editor, feeds
    api/                  submit · hint · trade · leaderboard · feed
prisma/
  schema.prisma           portable schema
  seed.ts                 items, the Shop, main rooms, timed bonus, arcade games
docs/
  ARCHITECTURE.md         stack, data model, request flows, conventions
  toolbox.md              the c- command reference
```

> [!TIP]
> **Contributing?** Read [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) before you start.

---

## 💎 The Economy

- **Points** — Determines leaderboard rank. Earned from solves only. Never spent.
- **Creds** — A wallet. Loot drops + first blood + achievement rewards. Spent at the Shop.
- **Shards** → Forge 3 of a set into a keycard at the Shop. 
- **Keycards** — Held (not spent) to enter gated rooms. Red+Green+Black → Shop → Master → **THE CORE**.
- **Titles** — The highest-priority achievement you hold shows next to your name.

Room layout, map coordinates, unlock rules, loot tables and the achievement catalog are all located in [`prisma/seed.ts`](prisma/seed.ts).
