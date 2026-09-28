# SitePilot

**Describe your website. AI runs it.**

SitePilot is an AI-powered autonomous website platform: you write a short brief, the
Orchestrator asks Mistral for a **blueprint** (reviewable and editable), then a team of
agents researches, writes, edits, SEO-optimises and publishes content on a schedule —
fully manual, review-gated, or in full autopilot.

> **Demo mode:** with no `MISTRAL_API_KEY` in development the app returns clearly marked
> demo AI output instead of failing, so the whole flow can be explored without a key.
> In production a missing key surfaces as a `503 AI_NOT_CONFIGURED` error — never as
> fake AI.

---

## 1. Requirements

| Tool        | Version                          |
| ----------- | -------------------------------- |
| Node.js     | 20.9+ (22 LTS recommended)       |
| npm         | 10+                              |
| PostgreSQL  | 14+ (see *Local database* below — a bundled binary is provided) |

Everything else is installed by `npm install`. Playwright is **not** required: UI
verification uses the built-in browser tooling.

## 2. Install

```powershell
npm install
```

> **PowerShell note:** if script execution is blocked, use `npm.cmd` / `npx.cmd`
> instead of `npm` / `npx`.

## 3. Environment variables

Copy the template, then edit values:

```powershell
Copy-Item .env.example .env
```

| Variable                | Required | Purpose                                                                 |
| ----------------------- | -------- | ----------------------------------------------------------------------- |
| `DATABASE_URL`          | ✅        | PostgreSQL connection string                                             |
| `MISTRAL_API_KEY`       | in prod  | Server-side Mistral key (never exposed to the browser)                  |
| `MISTRAL_MODEL`         | ⬜        | Model for heavy work; code default `mistral-small-latest`, `.env.example` ships `open-mistral-nemo` (verified on this key) |
| `MISTRAL_MODEL_FAST`    | ⬜        | Cheaper model for titles/tags/summaries                                 |
| `NEXTAUTH_SECRET`       | ✅        | Cookie signing secret — `openssl rand -base64 32`                       |
| `NEXTAUTH_URL`          | ✅        | Canonical app URL (`http://localhost:3000` in dev)                      |
| `NEXT_PUBLIC_APP_URL`   | ⬜        | Public origin used in preview links / sitemap / robots                  |
| `CRON_SECRET`           | ✅ (cron) | Bearer token for `POST /api/cron`                                       |
| `STRIPE_SECRET_KEY`     | ⬜        | Reserved for billing (unused in the MVP; only flips a `billing.enabled` flag in `/api/settings`) |
| `SEARCH_PROVIDER`       | ⬜        | Reserved for a real search backend. **No provider is implemented yet** — research is explicitly mocked and every row is marked `isMock` (see `src/lib/agents/research-provider.ts`) |
| `DISABLE_SCHEDULER`     | ⬜        | `1` disables the in-process autopilot loop (use for multi-instance deploys) |

`.env` is git-ignored — never commit it. All reads go through `src/lib/env.ts`;
only `NEXT_PUBLIC_*` values can reach the browser.

## 4. Local database (bundled PostgreSQL)

Instead of installing PostgreSQL yourself, the repo bootstraps a local cluster from
the `embedded-postgres` binaries:

```powershell
npm run db:start          # initdb + create DB + start, idempotent
```

* Binaries staged to `~/.sitepilot/pgbin`, data directory `~/.sitepilot/postgres`
* Encoding `UTF8`, locale `C`, local trust auth, host auth `scram-sha-256`
* Prints the effective `DATABASE_URL` (password masked)

To use your own PostgreSQL, simply set `DATABASE_URL` — `db:start` is then optional.

> **Timezone gotcha.** Prisma treats `timestamp` columns as UTC, but the bundled
> cluster keeps the OS timezone (`Europe/Moscow` here), so a raw
> `now() - interval '…'` written through psql/`pg` lands *hours ahead* of what
> the app reads — a stale-row query will silently match nothing. Always write
> `(now() AT TIME ZONE 'utc')` for timestamps in ad-hoc SQL. The application
> itself only writes through Prisma, so it is unaffected.

### Migrations & seed

```powershell
npm run db:migrate        # prisma migrate dev — create/apply migrations
npm run db:deploy         # prisma migrate deploy — production
npm run db:seed           # development demo data
npm run db:studio         # Prisma Studio
npm run db:setup          # start + migrate + seed in one step
```

**Seed content (development only):**

* login `demo@sitepilot.dev` / `sitepilot-demo`
* site **“Nordic Explorer”** with `isDemo = true`, blueprint, categories, pages,
  published + draft articles, agent runs marked `isDemo`, usage events and 30 days of
  analytics rows marked `source = "demo"`
* production runs are skipped unless `ALLOW_DEMO_SEED=1`

Re-running the seed replaces the demo site deterministically (cascade delete + recreate).

## 5. Development

```powershell
npm run dev               # http://localhost:3000
```

Other scripts:

```powershell
npm run lint              # ESLint (flat config)
npm run typecheck         # tsc --noEmit
npm test                  # vitest run
npm run build             # prisma generate && next build
npm run start             # production server
npm run format            # prettier --write .
```

## 6. Production build & deploy

```powershell
# 1. environment
Copy-Item .env.example .env      # set real values, NODE_ENV=production

# 2. database
npm run db:deploy                # prisma migrate deploy
npm run db:seed                  # optional — skipped in production unless ALLOW_DEMO_SEED=1

# 3. build & run
npm run build
npm run start
```

> **Windows:** stop `npm run dev` before `npm run build`. The running dev server
> keeps the Prisma query-engine DLL locked, and `prisma generate` (part of the
> build script) fails with `EPERM` while it is held.

* Recommended: one long-running Node instance (the autopilot scheduler runs in-process,
  guarded by a global). For multiple instances set `DISABLE_SCHEDULER=1` everywhere and
  drive `POST /api/cron` from an external scheduler.
* Cron example (every 15 minutes):

  ```powershell
  Invoke-RestMethod -Method Post -Uri https://your-app/api/cron `
    -Headers @{ Authorization = "Bearer $env:CRON_SECRET" }
  ```

* Docker/PM2/systemd all work — it is a standard Next.js server with a PostgreSQL
  dependency. Health check: `GET /` returns `200`.

## 7. Mistral integration

All AI traffic flows through **one** service: `src/lib/ai/mistral.ts`.

```ts
generateText(prompt, options)               // free-form text
generateStructuredOutput(prompt, schema)    // Zod-validated JSON + 1 repair retry
```

* `MISTRAL_API_KEY` is read server-side only (`src/lib/env.ts`); the browser never
  sees it, and prompts never leave the server.
* The model is env-driven (`MISTRAL_MODEL`, `MISTRAL_MODEL_FAST`) — change models
  without touching code.
* Every call is wrapped in `withAgentRun(...)` which records tokens, duration and cost
  in `AgentRun` + `UsageEvent`, so per-site usage stays visible and bounded.
* Responses are **data**: every structured output is validated with Zod before it is
  written to the database. The model never emits code, SQL or shell — the rendering
  engine parses Markdown/blocks into React elements, never `dangerouslySetInnerHTML`.
* Failure handling: invalid JSON ⇒ one repair attempt ⇒ `AI_RESPONSE_INVALID (502)`;
  rate limit ⇒ `RATE_LIMITED (429)`; missing key in production ⇒ `AI_NOT_CONFIGURED (503)`.
* Schemas are deliberately forgiving where models drift (`catch("")`, type coercion,
  length headroom): a slightly off answer becomes clean data instead of a failed task.

### Agents & permissions

| Agent        | May call                                  | Never touches                                  |
| ------------ | ----------------------------------------- | ---------------------------------------------- |
| Orchestrator | enqueue/dispatch tasks, read site context | secrets, billing, raw SQL                      |
| Research     | research provider (mock when unconfigured)| writes to content tables                       |
| Writer       | draft content (structured output)         | publishing, site settings                      |
| Editor       | rewrite/shorten existing drafts           | deletion of records                            |
| SEO          | SEO metadata, audit issues                | `noindex` decisions without user consent       |
| Analytics    | read analytics/SEO aggregates             | writes outside analytics counters              |
| Publisher    | publish/schedule owned site content       | account, billing, other sites’ data            |

Permissions are declared in `src/lib/agents/permissions.ts` and asserted before any
tool runs (`assertPermission`). Access control for user data lives in
`src/lib/auth/guards.ts` (`requireUser`, `getOwnedSite`, `getOwnedArticle`) and every
API route validates its payload with Zod.

### AI activity

Every agent execution is an `AgentRun` row (agent, task type, model, status, tokens,
duration, short input/output summaries — never secrets). The **AI Activity** page
(`/activity`) filters runs by site, agent and status; the per-site tab shows the same
history scoped to one site.

## 8. Autopilot

* Modes: **Manual** / **Review before publishing** / **Full autopilot**
  (`PATCH /api/sites/:id/autopilot`).
* `src/lib/scheduler` computes the next run in the site’s timezone
  (`computeNextRun`), queues a `GENERATE_ARTICLE` task, and the in-process loop
  (`schedulerTick`) dispatches due tasks through the orchestrator pipeline:
  research → writer → editor → seo → publisher.
* Manual mode cancels queued generation tasks and disables the schedule.
* The loop is booted by `src/instrumentation.ts` → `instrumentation.node.ts`.
  This indirection is required: Next.js only ever resolves a file named
  `instrumentation.<ext>`, so the `.node` file on its own is never loaded and
  nothing would run. Set `DISABLE_SCHEDULER=1` to opt out, or drive ticks from
  outside with `POST /api/cron`.
* Every tick first recovers tasks that stalled in `RUNNING` (requeued until
  `MAX_TASK_ATTEMPTS`, then failed) and drops expired sessions, then dispatches
  due tasks.

## 9. Internationalisation & theming

* UI languages: **English (default), Русский, 한국어** — `locales/{en,ru,ko}.json`,
  selected via the visible language switcher (persisted in the `sitepilot_locale`
  cookie).
* No hard-coded UI strings: everything goes through `t("dot.path")`;
  `tests/i18n-keys.test.ts` scans the source tree and fails on missing keys,
  `tests/i18n.test.ts` enforces key parity across the three locales.
* Site content language is independent of the UI language (per-site setting).
* `dir` is resolved from the locale (RTL-ready: the layout and design tokens never
  assume a direction), dates/numbers are formatted per locale
  (`formatDate` / `formatNumber`), and dark mode supports light/dark/system with a
  no-flash script.

## 10. Testing

```powershell
npm test
```

| File                        | Covers                                                        |
| --------------------------- | ------------------------------------------------------------- |
| `tests/blueprint-schema.test.ts`  | blueprint validation, defaults, hostile input rejection    |
| `tests/article-generation.test.ts`| generated article/SEO/content-plan response validation      |
| `tests/site-ownership.test.ts`    | `getOwnedSite` access control (member / stranger / missing) |
| `tests/autopilot.test.ts`         | autopilot task creation, MANUAL cancellation, schedule maths |
| `tests/task-policy.test.ts`       | retry/backoff policy: attempt cap, transient vs permanent failures |
| `tests/stale-tasks.test.ts`       | recovery of tasks left `RUNNING` by a crashed process |
| `tests/session-token.test.ts`     | session tokens are stored hashed, never in the clear |
| `tests/i18n.test.ts`              | locale parity, translation switching, locale-aware formats  |
| `tests/i18n-keys.test.ts`         | every `t()` key used in `src/` exists                       |

Run `npm run lint && npm run typecheck && npm test && npm run build` before
shipping — CI runs the same sequence on every push
(`.github/workflows/ci.yml`).

## 11. Project structure

```
├── locales/                 en.json · ru.json · ko.json (all UI strings)
├── prisma/
│   ├── schema.prisma        full data model (orgs, sites, content, AI, analytics)
│   ├── migrations/
│   └── seed.ts              development-only demo site “Nordic Explorer”
├── scripts/db.mjs           local PostgreSQL bootstrap
├── src/
│   ├── app/
│   │   ├── (auth)/          login · signup
│   │   ├── (app)/           dashboard · sites · content · activity · schedule · analytics · settings
│   │   ├── preview/         owner-only site preview (+ sitemap.xml, robots.txt)
│   │   ├── a|c|p/[slug]     public routes for published sites
│   │   └── api/             validated JSON endpoints (envelope { ok, data | error })
│   ├── components/          UI primitives, layout, editor, charts, preview renderer
│   ├── lib/
│   │   ├── agents/          orchestrator + research/writer/editor/seo/analytics/publisher
│   │   ├── ai/              mistral service, Zod schemas, prompts/, demo fallback
│   │   ├── api/             request/response envelope, client fetch helpers
│   │   ├── auth/            password, session cookie, guards
│   │   ├── i18n/            dictionaries, provider, server helpers, locale config
│   │   ├── scheduler/       timezone-aware autopilot
│   │   ├── seo/             limits, meta builders, audit rules, sitemap/robots
│   │   ├── analytics/       counters and aggregates
│   │   └── services/        sites · articles · activity (used by API routes)
│   └── app/globals.css      design tokens + component classes
└── tests/                   vitest suites
```

## 12. API overview

All endpoints return `{ ok: true, data }` or
`{ ok: false, error: { code, message, issues? } }` and validate input with Zod.

| Method & path                                   | Purpose                                  |
| ----------------------------------------------- | ---------------------------------------- |
| `POST /api/auth/signup` · `login` · `logout`     | session cookie auth                      |
| `POST/GET/PATCH /api/sites`                      | create / list / update (ownership-checked)|
| `POST/GET/PUT /api/sites/:id/blueprint`          | generate, fetch, save blueprint          |
| `POST /api/sites/:id/generate`                   | build categories, pages and articles     |
| `GET/POST /api/sites/:id/articles`               | list / create content                    |
| `PATCH/DELETE /api/articles/:id`                 | edit / remove                            |
| `POST /api/articles/:id/{generate,improve,seo}`  | AI writing actions                       |
| `POST/GET /api/sites/:id/autopilot`              | enable/disable autopilot (mode)          |
| `GET /api/sites/:id/{activity,tasks,schedule,analytics,seo}` | history, queue, cadence, data |
| `GET /api/cron` (POST + `CRON_SECRET`)           | external scheduler tick                  |

## 13. Security & cost notes

* Session = random token in an httpOnly, `SameSite=Lax` cookie (`sitepilot_session`);
  only `sha256(token)` is stored in the database, so a leaked dump cannot be
  replayed as a login. Expired rows are purged on every scheduler tick.
  Passwords are hashed with bcrypt; state-changing requests are CSRF-safe via
  same-origin `POST/PATCH/PUT/DELETE`.
* Every query is scoped to the authenticated user's organization; previews are
  owner-only; no stack traces are rendered to users and logs never include secrets.
* AI calls are centralised, rate-limited per IP/session, cached where safe, and metered
  per site (`UsageEvent`) so runaway loops cannot silently burn the budget.
* Agent tasks are claimed atomically, retried up to 3 times with exponential
  backoff, and any task left `RUNNING` by a crashed process is re-queued (or
  failed once out of attempts) on the next scheduler tick.
