# Deploying PSEUDO-BREACH

Target: **Vercel** (serverless) + **Neon** (Postgres) + **Upstash** (Redis) + **GitHub**.
All three services have a free tier with no card required.

## 1. Database — Neon

1. Create a project at <https://console.neon.tech>. Pick a region close to your players.
2. Copy **two** connection strings from the dashboard:
   - **Pooled** (host contains `-pooler`) → `DATABASE_URL`
   - **Direct** (no `-pooler`) → `DIRECT_URL`
3. In `prisma/schema.prisma` change the datasource:
   ```prisma
   datasource db {
     provider  = "postgresql"
     url       = env("DATABASE_URL")
     directUrl = env("DIRECT_URL")
   }
   ```
4. Turn `db push` into a real migration history:
   ```bash
   rm -rf prisma/migrations
   npx prisma migrate dev --name init      # against a dev Neon branch
   ```
   The schema is written to be portable (no enums / scalar lists / native JSON), so this
   is a clean switch — but run `npm run test` and `npm run selftest` against Neon before
   trusting it.

## 2. Rate limiting — Upstash

1. Create a Redis database at <https://console.upstash.com/redis>.
2. Copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
   > Without these the app falls back to a per-instance in-memory limiter. On Vercel that
   > means the limit is per lambda, not global — **set Upstash for the real event.**

## 3. Secrets

Generate:

```bash
node -e "console.log('AUTH_SECRET='+require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('FLAG_SECRET='+require('crypto').randomBytes(32).toString('hex'))"
```

`FLAG_SECRET` must stay constant for the whole event — every per-user flag is derived from
it. If it changes, every issued flag changes.

## 4. Vercel

1. Push the repo to GitHub, import it at <https://vercel.com/new>.
2. Project → Settings → Environment Variables (Production):

   | var | value |
   |---|---|
   | `DATABASE_URL` | Neon pooled string |
   | `DIRECT_URL` | Neon direct string |
   | `AUTH_SECRET` | generated |
   | `FLAG_SECRET` | generated |
   | `UPSTASH_REDIS_REST_URL` | from Upstash |
   | `UPSTASH_REDIS_REST_TOKEN` | from Upstash |
   | `NEXT_PUBLIC_ACTIVE_EVENT` | `pseudo-breach-main` (or `demo-session` for the practice run) |

3. Build command stays `npm run build` (it runs `prisma generate`). Add a deploy step or
   run locally against prod once:
   ```bash
   npx prisma migrate deploy
   npm run db:seed
   ```
4. Deploy. Visit the URL, log in as `ADMIN001`, confirm `/admin` shows both events.

## 5. Accounts

```bash
# from a roster CSV with columns name,branch,year
npm run accounts -- --roster participants.csv --event pseudo-breach-main
# or just N generic logins
npm run accounts -- --count 150 --event pseudo-breach-main
```

Writes `accounts.csv` (registerId, password, name, …). Distribute rows privately. The file
is git-ignored — keep it that way.

## 6. Go-live

- Keep the main event at **`status: "draft"`** until start time — participants can log in
  and read module titles but cannot submit.
- At 18:00: `/admin` → main event → **live**.
- At 23:59: → **ended**. The leaderboard freezes; export results:
  ```bash
  npx prisma studio   # or a SQL dump of Solve + Submission
  ```

See [`runbook.md`](runbook.md) for failure handling.
