# Event-day runbook

Keep this open during the event. Admin panel: `/admin` (log in as `ADMIN001`).

## Dashboards to watch

- `/admin` — live solves feed + flag-sharing anomalies + per-room unlock rules + feed count
- `/leaderboard` — Operators / Years tabs + the live activity feed
- Vercel → project → Logs (filter to errors / 5xx)
- Neon → Monitoring (connections, CPU)
- Upstash → your Redis DB (command count, throttled requests)

## Before you flip it live (event day, afternoon)

- [ ] Log in with a burner account, crack `lobby` on production.
- [ ] `npm run selftest` against production DB → all green (crawls the whole dungeon).
- [ ] `npm run db:wipe -- --event pseudo-breach-main` → clears selftest solves **and the feed +
      achievement unlocks** it created, so players start on a clean board and empty activity feed.
- [ ] Confirm event `startsAt` / `endsAt` in `/admin` (IST = UTC+5:30). The two timed bonus rooms
      (`broadcast-booth` one-shot window, `supply-drop` recurring) anchor to this — sanity-check
      their `unlockRuleJson` in `/admin` → the room's expandable row.
- [ ] `accounts.csv` generated, spot-checked, distributed.
- [ ] Note the current Vercel deployment — that's your rollback target.
- [ ] Upstash env vars set (rate limiting is global, not per-lambda).

## During

| symptom | do this |
|---|---|
| Site slow / Neon CPU pinned | leaderboard cache TTL is 3s (`BOARD_TTL_MS` in `src/lib/game.ts`) — bump to 10000, redeploy. Enable Neon autoscaling. |
| A room is unsolvable / wrong flag | `/admin` → that event → expand the room → **hide room from players**. Post an announcement. |
| A timed room's window is wrong / players missed it | `/admin` → expand the room → edit `unlockRuleJson` (e.g. a fresh `{"windowAt":{"from":"…Z","to":"…Z"}}` or `{"open":true}` to just leave it open) → **save room**. Takes effect on the next dashboard refresh. |
| Activity feed is noisy / has test rows | `/admin` → that event → **clear feed**. |
| A player is stuck with no keycard (missed loot / bug) | `/admin/users` → find them → **grant** the item key (e.g. `keycard-red`, `frag-alpha`, `cred`) qty N. |
| Someone hammering `/api/submit` or `/api/trade` | Rate limiter returns 429. If it's abuse, `/admin/users` → **lock** the account. |
| Flag sharing | `/admin` → "FLAG-SHARING FLAGS" lists `submittedBy → mintedFor`. Lock the sharer, keep the audit row. Per-user flags are only on the two `perUserFlag` puzzles (`reception-caesar`, `core-final`). |
| Bad deploy | Vercel → Deployments → the last good one → **Promote to Production**. |
| Someone forgot their password | `/admin/users` → search → **reset pw** → read the new one to them privately. |
| Need to nudge everyone | `/admin` → announcement box → post (markdown OK). Banner on every dashboard within a refresh. |

## Scoring / economy reference (if a participant asks)

**Points** (leaderboard): `solve = base + rankBonus + speedBonus`

- base: per room by difficulty (50–350)
- rankBonus = `0.5 × base × 0.85^N`, N = solvers before you (→ 0 after ~15)
- speedBonus = up to `0.3 × base`, linear from instant → 0 at 90 min after the room opened
- wrong answers: no point loss, ~15s cooldown

**Creds** (wallet): loot drops + 10 for first blood + achievement rewards. Spent at the Shop.
THE HONEYPOT charges 5 creds per wrong guess. Creds never affect the leaderboard.

**Medals**: the first three to clear a room get 🥇🥈🥉 (shown on the room page). Derived from
solve order — nothing to configure. **Achievements** award creds + a title, never points; the
catalog is in `prisma/seed.ts`. **Year board**: `/leaderboard` → Years tab, sums each year's
players (from `User.year`).

Item keys for `/admin` grants: `cred`, `frag-alpha`, `frag-beta`, `keycard-blue`,
`keycard-red`, `keycard-green`, `keycard-black`, `keycard-master`, `trophy-onair`, and the
other `loot-*` / `trophy-*` keys in `prisma/seed.ts`.

Constants live in [`src/lib/scoring.ts`](../src/lib/scoring.ts); economy in
[`prisma/seed.ts`](../prisma/seed.ts).

## After

1. `/admin` → main event → **ended**.
2. Export `Solve` + `Submission` (Prisma Studio or SQL).
3. Final leaderboard = `/leaderboard` (frozen once ended).
4. Keep `FLAG_SECRET` if you might need to re-verify a disputed submission.

## Contacts

- Organiser 1: …
- Organiser 2: …
- Vercel / Neon / Upstash account owner: …
