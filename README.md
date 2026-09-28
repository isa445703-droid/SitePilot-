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
| `SITE_ADDRESSING`       | ⬜        | `subdomain` or `path` for public site URLs. Auto-detected: hosts that cannot serve wildcards (Vercel, Cloudflare Pages, GitHub Pages) use `/s/<slug>`, everything else uses `<slug>.<root>` |

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

### Deploy to Vercel

The app deploys as a plain Next.js project: middleware only parses the `Host`
header (edge-safe), Prisma runs in the Node runtime, and `DISABLE_SCHEDULER=1`
turns off the in-process loop — serverless instances are ephemeral.

```powershell
npx vercel login                             # browser device flow
npx vercel project add sitepilot
npx vercel link -p sitepilot --yes
npx vercel integration add neon --non-interactive   # marketplace terms are accepted once in the browser

# database (Neon): migrations + optional demo data
$env:DATABASE_URL = '<DATABASE_URL_UNPOOLED from .env.local>'   # unpooled for DDL
npx prisma migrate deploy
$env:ALLOW_DEMO_SEED = "1"; npx tsx prisma/seed.ts

npx vercel deploy --prod --yes               # builds server-side, `prisma generate` runs in `npm run build`
```

Environment variables (`vercel env add <NAME> production --value <value>`):
`DATABASE_URL` (injected by the Neon integration), `MISTRAL_API_KEY`,
`MISTRAL_MODEL`, `MISTRAL_MODEL_FAST`, `NEXTAUTH_SECRET`, `CRON_SECRET`,
`NEXT_PUBLIC_APP_URL`, `NEXTAUTH_URL`, `DISABLE_SCHEDULER=1`.

Scheduling on Vercel:

* The **Hobby** plan allows cron jobs **once per day only** — `vercel.json` ships
  `0 3 * * *` hitting `GET /api/cron` (Vercel sends
  `Authorization: Bearer $CRON_SECRET` automatically when `CRON_SECRET` is set).
  Expressions more frequent than daily fail the deployment on Hobby.
* For minute-level autopilot, call `POST /api/cron` every minute from an external
  scheduler (cron-job.org, CI, or a local loop). The tick tolerates concurrent
  callers: the claim is atomic and overlapping ticks are skipped.
* Generated sites are served at `/s/<slug>/…`. The `<slug>.<root-domain>` form
  needs a custom domain with a wildcard DNS record (`*.yourdomain.com → Vercel`).

## 7. Mistral integration

All AI traffic flows through **one** service: `src/lib/ai/mistral.ts`.

```ts
generateText(prompt, options)               // free-form text
generateStructuredOutput(prompt, schema)    // Zod-validated JSON, self-repairing
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
* Failure handling distinguishes three cases instead of blindly retrying the same
  request (`src/lib/ai/mistral.ts` + `src/lib/ai/repair.ts`):
  * **truncated completion** (`finish_reason: "length"`) ⇒ re-request with a doubled
    token budget. The cut payload is never "repaired": closing the braces would
    validate a half-written article and publish it.
  * **malformed JSON** ⇒ lenient parse (markdown fences, prose around the payload,
    trailing commas, unclosed structures), then a corrective retry that carries the
    exact Zod issues back to the model.
  * **schema drift** ⇒ safe normalisation first — shrink over-long strings/arrays to
    their declared limits, unwrap `content: { text }`, coerce `"42"` — then the
    corrective retry, then `AI_RESPONSE_INVALID (502)`.
  Rate limit ⇒ `RATE_LIMITED (429)`; missing key in production ⇒ `AI_NOT_CONFIGURED (503)`.
* Repair never invents content: values are only shrunk, unwrapped or coerced, missing
  required fields always go back to the model, and every applied fix is logged as
  `ai_structured_repaired`. At most three attempts are spent per call, so a poisoned
  task still fails fast into the scheduler's own retry budget.

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
* Ticks never overlap: a single in-process lock makes a tick that is still
  working (article generation takes 40-80s, the interval fires every 60s) log
  `scheduler_tick_skipped` and return instead of racing the previous tick.
  Tick results report `ran / completed / failed / skipped`, where `skipped` is a
  claim lost to a concurrent runner — that is logged as `task_claim_miss`, never
  counted as a task failure.
* Queueing the autopilot's next article is a *count-then-create* pair; two
  runners (tick vs. an API-triggered run) could each see an empty queue and both
  queue a task, silently doubling the publishing rate. The pair now runs inside
  a transaction holding a `SELECT … FOR UPDATE` row lock on the site
  (`withSiteQueueLock`), so the loser waits and then sees the winner's task.
  This is deliberately a lock and not a unique index: `GENERATE_CONTENT_PLAN`
  legitimately queues up to three article tasks at once, which a
  one-pending-task-per-site index would reject.

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

## 10. Generated-site design system

Public sites and the dashboard preview render through the same components, so
what an owner previews is exactly what a visitor gets.

* **Tokens** — the AI (or a human in the blueprint editor) picks the base
  colours; `src/lib/preview/color.ts` derives every other role from them:
  surface, page background, muted text, borders, three shadow levels, button
  fill and label ink. Each derivation is contrast-guarded (WCAG), so a
  washed-out palette is corrected instead of shipping unreadable pages.
* **Palette split** — `SiteDesign` stores `surfaceColor` (cards, header,
  footer) separately from `backgroundColor` (the page behind them), plus
  `mutedColor`. `normalizeDesign()` migrates rows written before the split, for
  both light and dark sites, so existing sites keep their look.
* **Style axes** — `fontStyle` (modern/classic/editorial), `layoutStyle`
  (centered/wide/magazine), `cardStyle` (soft/flat/outlined), `cardDensity`
  (compact/comfortable), `headerStyle` (plain/brand/gradient) and `heroStyle`
  (simple/banded/centered) compose into the final look.
* **Rendering** — sticky blurred header with a brand mark and a scrollable
  mobile nav, skip link, hero band, featured card, category chips, breadcrumbs,
  related articles, print styles and `prefers-reduced-motion` support. All of it
  is a server component: public pages ship no extra JavaScript.
* **Addressing** — sites are served at `/s/<slug>/…`, or on `<slug>.<root>` when
  the host supports wildcard DNS. `siteAddressing()` picks path mode
  automatically on Vercel/Cloudflare Pages/GitHub Pages, and `SITE_ADDRESSING`
  overrides it. Internal links are always site-scoped; the legacy global
  `/a|p|c/<slug>` routes remain for old inbound links, render the owning site and
  advertise a canonical URL.
* **Unicode slugs** — `slugify()` keeps Cyrillic and Hangul letters, so every
  public route decodes its parameters through `decodeRouteParam()` before
  querying. Without it a site named "Дом" would 404 on every link.

## 11. Testing

```powershell
npm test
```

| File                        | Covers                                                        |
| --------------------------- | ------------------------------------------------------------- |
| `tests/blueprint-schema.test.ts`  | blueprint validation, defaults, hostile input rejection    |
| `tests/article-generation.test.ts`| generated article/SEO/content-plan response validation      |
| `tests/ai-repair.test.ts`         | tolerant JSON parsing, safe output repair, truncation retry (mocked provider) |
| `tests/instrumentation.test.ts`   | scheduler boots through the entry point Next.js actually loads |
| `tests/scheduler-tick.test.ts`    | tick mutex (no overlapping ticks) and `ran/completed/failed/skipped` accounting |
| `tests/task-claim.test.ts`        | atomic claim: a lost race is `skipped`, a vanished task is warned about |
| `tests/autopilot.test.ts`         | autopilot creation, MANUAL cancellation, schedule maths, per-site queue lock |
| `tests/site-ownership.test.ts`    | `getOwnedSite` access control (member / stranger / missing) |
| `tests/autopilot.test.ts`         | autopilot task creation, MANUAL cancellation, schedule maths |
| `tests/task-policy.test.ts`       | retry/backoff policy: attempt cap, transient vs permanent failures |
| `tests/stale-tasks.test.ts`       | recovery of tasks left `RUNNING` by a crashed process |
| `tests/session-token.test.ts`     | session tokens are stored hashed, never in the clear |
| `tests/i18n.test.ts`              | locale parity, translation switching, locale-aware formats  |
| `tests/i18n-keys.test.ts`         | every `t()` key used in `src/` exists                       |
| `tests/preview-design.test.ts`    | colour maths (contrast/mix), button fill+ink choice, legacy design migration |
| `tests/route-params.test.ts`      | percent-encoded Unicode slugs decode and round-trip         |
| `tests/site-url.test.ts`          | public addressing: subdomain vs path mode, host → site slug  |

Run `npm run lint && npm run typecheck && npm test && npm run build` before
shipping — CI runs the same sequence on every push
(`.github/workflows/ci.yml`).

## 12. Project structure

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

## 13. API overview

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

## 14. Security & cost notes

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

