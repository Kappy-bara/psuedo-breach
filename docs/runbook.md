# Event-day runbook

Keep this open during the event. Admin panel: `/admin` (log in as `ADMIN001`).

## Dashboards to watch

- `/admin` — live solves feed + flag-sharing anomalies
- Vercel → project → Logs (filter to errors / 5xx)
- Neon → Monitoring (connections, CPU)
- Upstash → your Redis DB (command count, throttled requests)

## Before you flip it live (event day, afternoon)

- [ ] Log in with a burner account, solve `orientation` on production.
- [ ] `npm run selftest` against production DB → 17/17.
- [ ] Confirm event `startsAt` / `endsAt` in `/admin` (IST = UTC+5:30).
- [ ] `accounts.csv` generated, spot-checked, distributed.
- [ ] Note the current Vercel deployment — that's your rollback target.
- [ ] Upstash env vars set (rate limiting is global, not per-lambda).

## During

| symptom | do this |
|---|---|
| Site slow / Neon CPU pinned | `/api/leaderboard` cache TTL is 3s in code — bump `TTL_MS` in `src/app/api/leaderboard/route.ts` to 10000, redeploy. Enable Neon autoscaling. |
| A puzzle is unsolvable / wrong flag | `/admin` → that event → click the module chip to **hide** it. Post an announcement. Award nothing rather than a broken flag. |
| Someone hammering `/api/submit` | Rate limiter already returns 429. If it's abuse, `/admin/users` → **lock** the account. |
| Flag sharing | `/admin` → "FLAG-SHARING FLAGS" panel lists `submittedBy → mintedFor`. Lock the sharer, tell the organisers, keep the audit row. |
| Bad deploy | Vercel → Deployments → the last good one → **Promote to Production**. |
| Someone forgot their password | `/admin/users` → search → **reset pw** → read the new one to them privately. |
| Need to nudge everyone | `/admin` → announcement box → post (markdown OK). Shows as a banner on every dashboard within a refresh. |

## Scoring reference (if a participant asks)

`solve = base + rankBonus + speedBonus`

- base: 100 / 150 / 200 / 250 / 300 / 350 / 500 by puzzle
- rankBonus = `0.5 × base × 0.85^N`, N = solvers before you (→ 0 after ~15)
- speedBonus = up to `0.3 × base`, linear from instant → 0 at 90 min after the module opened
- wrong answers: no point loss, ~15s cooldown
- hints: mostly free; a few are token-gated or terminal-only

Constants live in [`src/lib/scoring.ts`](../src/lib/scoring.ts).

## After

1. `/admin` → main event → **ended**.
2. Export `Solve` + `Submission` (Prisma Studio or SQL).
3. Final leaderboard = `/leaderboard` (frozen once ended).
4. Keep `FLAG_SECRET` if you might need to re-verify a disputed submission.

## Contacts

- Organiser 1: …
- Organiser 2: …
- Vercel / Neon / Upstash account owner: …
