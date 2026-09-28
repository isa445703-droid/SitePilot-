/**
 * Development-only seed: creates a demo account and the "Nordic Explorer"
 * demo site so the product can be explored immediately.
 *
 * Everything created here is marked with `isDemo = true` (site, runs) or
 * `source = "demo"` (analytics) so the UI can label it honestly.
 *
 * Production runs are skipped unless ALLOW_DEMO_SEED=1 is set.
 *
 *   npm run db:seed
 */
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";

function loadEnvFile(): void {
  if (process.env.DATABASE_URL) return;
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) continue;
    const key = match[1];
    const value = match[2].replace(/^["']|["']$/g, "");
    if (!(key in process.env)) process.env[key] = value;
  }
}

const DEMO_EMAIL = "demo@sitepilot.dev";
const DEMO_PASSWORD = "sitepilot-demo";
const SITE_SLUG = "nordic-explorer";

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_SEED !== "1") {
    console.log("[seed] skipped: production environment (set ALLOW_DEMO_SEED=1 to force)");
    return;
  }

  loadEnvFile();

  if (!process.env.DATABASE_URL) {
    console.error("[seed] DATABASE_URL is not set — run `npm run db:start` and check .env");
    process.exitCode = 1;
    return;
  }

  const { db } = await import("../src/lib/db/prisma");

  try {
    // --- demo user & workspace ------------------------------------------
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
    const user = await db.user.upsert({
      where: { email: DEMO_EMAIL },
      update: { name: "Demo Explorer" },
      create: {
        email: DEMO_EMAIL,
        name: "Demo Explorer",
        passwordHash,
        locale: "en",
        theme: "system",
      },
    });

    const organization = await db.organization.upsert({
      where: { slug: "demo-workspace" },
      update: { name: "Demo Workspace" },
      create: { name: "Demo Workspace", slug: "demo-workspace" },
    });

    await db.orgMember.upsert({
      where: { organizationId_userId: { organizationId: organization.id, userId: user.id } },
      update: { role: "OWNER" },
      create: { organizationId: organization.id, userId: user.id, role: "OWNER" },
    });

    await db.subscription.upsert({
      where: { organizationId: organization.id },
      update: {},
      create: { organizationId: organization.id, plan: "FREE", status: "ACTIVE" },
    });

    // Re-seed deterministically: drop a previous demo site (cascades).
    await db.site.deleteMany({ where: { slug: SITE_SLUG } });

    // --- demo site -------------------------------------------------------
    const site = await db.site.create({
      data: {
        organizationId: organization.id,
        createdById: user.id,
        name: "Nordic Explorer",
        slug: SITE_SLUG,
        description:
          "A travel guide to Scandinavia and the Arctic: destinations, seasonal itineraries and practical tips for northern trips.",
        brief:
          "Build a travel blog about Northern Europe — Norway, Sweden, Finland, Iceland. Cover destinations, northern lights, winter road trips, food and budget tips. Friendly expert tone, 3 articles a week.",
        language: "en",
        timezone: "Europe/Helsinki",
        targetAudience: "Independent travellers planning 1–3 week trips to the Nordics",
        primaryGoal: "Grow organic traffic with useful, seasonal travel guides",
        tone: "Warm, practical, expert",
        status: "LIVE",
        autopilot: "REVIEW",
        frequency: "THREE_A_WEEK",
        publishHour: 8,
        isDemo: true,
        blueprint: {
          siteName: "Nordic Explorer",
          description:
            "A travel guide to Scandinavia and the Arctic: destinations, seasonal itineraries and practical tips for northern trips.",
          targetAudience: "Independent travellers planning 1–3 week trips to the Nordics",
          primaryGoal: "Grow organic traffic with useful, seasonal travel guides",
          language: "en",
          tone: "Warm, practical, expert",
          categories: [
            { name: "Destinations", description: "Country and city guides across the Nordics" },
            { name: "Seasons", description: "Aurora, midnight sun and winter road trips" },
            { name: "Practical", description: "Budgets, transport and packing advice" },
          ],
          pages: [
            { title: "Home", slug: "", purpose: "Gateway to the latest Nordic guides" },
            { title: "About", slug: "about", purpose: "Who writes the guides and why" },
            { title: "Contact", slug: "contact", purpose: "Questions and collaboration" },
          ],
          contentTypes: ["long-form guide", "checklist", "itinerary"],
          publishingFrequency: "THREE_A_WEEK",
          seoStrategy: {
            approach: "Seasonal long-tail keywords with strong internal linking",
            keywords: ["northern lights", "norway road trip", "iceland winter", "stockholm guide"],
          },
          monetization: ["affiliate links", "newsletter"],
          design: {
            primaryColor: "#1d4ed8",
            secondaryColor: "#0f172a",
            surfaceColor: "#ffffff",
            backgroundColor: "#f5f7fb",
            textColor: "#0f172a",
            mutedColor: "#4b5563",
            fontStyle: "editorial",
            layoutStyle: "wide",
            cardStyle: "soft",
            headerStyle: "plain",
            heroStyle: "banded",
            cardDensity: "comfortable",
            borderRadius: 14,
          },
        },
        brand: {
          create: {
            brandVoice: "Warm, practical, expert — like an experienced travel friend.",
            tone: "Warm, practical, expert",
            guidelines: "Short sentences, concrete numbers, honest trade-offs.",
            keywords: ["northern lights", "norway road trip", "iceland winter", "stockholm guide"],
            audienceNotes: "Independent travellers, 25–45, planning 1–3 week trips",
          },
        },
        design: {
          create: {
            primaryColor: "#1d4ed8",
            secondaryColor: "#0f172a",
            surfaceColor: "#ffffff",
            backgroundColor: "#f5f7fb",
            textColor: "#0f172a",
            mutedColor: "#4b5563",
            fontStyle: "editorial",
            layoutStyle: "wide",
            cardStyle: "soft",
            headerStyle: "plain",
            heroStyle: "banded",
            cardDensity: "comfortable",
            borderRadius: 14,
          },
        },
        settings: {
          create: {
            siteTitle: "Nordic Explorer",
            metaDescription:
              "Practical guides to Norway, Sweden, Finland and Iceland: northern lights, winter road trips and budgets.",
            footerText: "Independent Nordic travel guides",
            indexable: true,
          },
        },
        schedule: {
          create: {
            frequency: "THREE_A_WEEK",
            timezone: "Europe/Helsinki",
            publishHour: 8,
            enabled: true,
            nextRunAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        },
      },
    });

    // --- categories & pages ----------------------------------------------
    const destinations = await db.category.create({
      data: {
        siteId: site.id,
        name: "Destinations",
        slug: "destinations",
        description: "Country and city guides across the Nordics",
        order: 0,
      },
    });
    const seasons = await db.category.create({
      data: {
        siteId: site.id,
        name: "Seasons",
        slug: "seasons",
        description: "Aurora, midnight sun and winter road trips",
        order: 1,
      },
    });
    const practical = await db.category.create({
      data: {
        siteId: site.id,
        name: "Practical",
        slug: "practical",
        description: "Budgets, transport and packing advice",
        order: 2,
      },
    });

    await db.page.createMany({
      data: [
        {
          siteId: site.id,
          title: "Home",
          slug: "",
          type: "HOME",
          status: "PUBLISHED",
          order: 0,
          content: [
            { type: "heading", level: 1, text: "Nordic Explorer" },
            {
              type: "paragraph",
              text: "Honest, practical guides to Scandinavia and the Arctic — written for people who actually go.",
            },
          ],
          seoTitle: "Nordic Explorer — practical Nordic travel guides",
          seoDescription: "Guides to Norway, Sweden, Finland and Iceland.",
        },
        {
          siteId: site.id,
          title: "About",
          slug: "about",
          type: "ABOUT",
          status: "PUBLISHED",
          order: 1,
          content: [
            { type: "heading", level: 1, text: "About Nordic Explorer" },
            {
              type: "paragraph",
              text: "We test the routes, the trains and the hostels ourselves so your trip doesn't have to be the experiment.",
            },
          ],
        },
        {
          siteId: site.id,
          title: "Contact",
          slug: "contact",
          type: "CONTACT",
          status: "PUBLISHED",
          order: 2,
          content: [
            { type: "heading", level: 1, text: "Contact" },
            { type: "paragraph", text: "Questions, corrections or collaboration ideas: hello@nordicexplorer.example" },
          ],
        },
      ],
    });

    // --- articles ---------------------------------------------------------
    const articles: Array<{
      title: string;
      slug: string;
      excerpt: string;
      content: string;
      status: "PUBLISHED" | "REVIEW" | "DRAFT";
      categoryId: string;
      tags: string[];
      seoTitle: string;
      seoDescription: string;
      publishedDaysAgo: number;
    }> = [
      {
        title: "Chasing the northern lights from Tromsø",
        slug: "northern-lights-tromso",
        excerpt: "Where to stand, when to go and how to read a real aurora forecast.",
        status: "PUBLISHED",
        categoryId: seasons.id,
        tags: ["norway", "aurora", "winter"],
        seoTitle: "Northern lights in Tromsø: a practical guide",
        seoDescription: "Best viewpoints, forecast tools and realistic timing for aurora hunting in Tromsø.",
        publishedDaysAgo: 2,
        content: `# Chasing the northern lights from Tromsø

Tromsø sits inside the auroral oval, which means you do not need a miracle — you need a clear night and a little patience.

## Before you go

- Check the **Kp index** and local cloud cover separately: clear sky beats high Kp.
- Give yourself *four nights*; one cloudy night is normal in February.
- Dress for standing still: the cold matters more than the walking.

## Best viewpoints

1. **Prestvannet lake** — a 15 minute walk from the centre, no car needed.
2. **Ersfjordbotn** — a short drive west, darker horizon.
3. **The fjord road to Kvaløya** — pull over safely and look north.

> The camera is optional. The best shows last ten minutes and are brighter than any photo suggests.

## Realistic expectations

February and March give the best balance of dark nights and milder weather. Solar maximum helps, but a quiet night is still quiet — plan *activities* for the day so the night is a bonus, not the whole trip.`,
      },
      {
        title: "Norway in winter: a 10-day road trip itinerary",
        slug: "norway-winter-road-trip",
        excerpt: "Bergen to the Lofoten islands with realistic driving times and stopovers.",
        status: "PUBLISHED",
        categoryId: destinations.id,
        tags: ["norway", "road trip", "itinerary"],
        seoTitle: "10-day Norway winter road trip (Bergen → Lofoten)",
        seoDescription: "A tested winter route through western Norway with distances, daylight windows and detours.",
        publishedDaysAgo: 6,
        content: `# Norway in winter: a 10-day road trip

Winter narrows your daylight to roughly **six hours**. That is enough — if you plan the driving around it.

## Day plan

| Day | Route | Driving |
| --- | --- | --- |
| 1–2 | Bergen, day trips | 0 h |
| 3 | Bergen → Ålesund | 4 h 30 |
| 4–5 | Ålesund → Geiranger | 3 h |
| 6 | Geiranger → Trondheim | 5 h |
| 7–10 | Trondheim → Lofoten | 6 h |

> Ferries and mountain passes decide your real timing more than the map does.

## What actually matters

- Book *flexible* accommodation; weather will move a night or two.
- Tyres are mandatory, but **snow experience** matters more than the tyre sticker.
- Daylight stops around 16:00 — schedule the scenic part at midday.`,
      },
      {
        title: "Is Iceland in February worth it?",
        slug: "iceland-february-worth-it",
        excerpt: "Weather, prices and crowds: what February really feels like on the ring road.",
        status: "PUBLISHED",
        categoryId: destinations.id,
        tags: ["iceland", "winter", "budget"],
        seoTitle: "Iceland in February: weather, prices, roads",
        seoDescription: "What February is genuinely like in Iceland — daylight, costs, road closures and how to plan around them.",
        publishedDaysAgo: 11,
        content: `# Is Iceland in February worth it?

Short answer: **yes, if you like weather as a plot twist.**

## The trade-offs

- ~5 hours of daylight, and the midday light is the good light.
- Prices are 15–30% below summer for cars and guesthouses.
- Some highland roads are closed; the ring road stays open but slow.

## Budget snapshot

A realistic day for two people: car *$90*, guesthouse *$130*, food *$70*.

## When to skip it

If your heart is set on hiking above the treeline, come in July instead. February rewards slow travel: hot pools, short drives, long dinners.`,
      },
      {
        title: "Stockholm in one day: a walking loop",
        slug: "stockholm-one-day",
        excerpt: "Gamla Stan, Södermalm and the water — a compact route that fits in a day.",
        status: "PUBLISHED",
        categoryId: destinations.id,
        tags: ["sweden", "city break"],
        seoTitle: "Stockholm in one day: walking itinerary",
        seoDescription: "A compact one-day walking route through Gamla Stan, Södermalm and the waterfront.",
        publishedDaysAgo: 16,
        content: `# Stockholm in one day

Start early, wear shoes you trust, and keep the ferry as your break.

## The loop

1. **Gamla Stan** at 09:00, before the tour groups.
2. Cross **Skeppsbron** and take the ferry to Djurgården.
3. Lunch near **Södermalm** — head for the windows, not the views.
4. Sunset from **Monteliusvägen**, five minutes from Skanstull.

> Everything above is walkable; total distance is about 8 km.`,
      },
      {
        title: "Packing for the Arctic: the list we actually use",
        slug: "arctic-packing-list",
        excerpt: "Layering that works at −20 °C without a suitcase full of gadgets.",
        status: "REVIEW",
        categoryId: practical.id,
        tags: ["packing", "winter", "gear"],
        seoTitle: "Arctic packing list: layers that work at −20 °C",
        seoDescription: "A tested layering system and packing list for Arctic trips, with what to leave at home.",
        publishedDaysAgo: 0,
        content: `# Packing for the Arctic

The system is simple: **base layer, insulating layer, shell.** Everything else is a detail.

## The three layers

- Base: merino, not cotton — ever.
- Insulation: one warm fleece plus a down jacket for stops.
- Shell: wind and wet matter more than the thermometer.

## Leave at home

Cotton jeans, three pairs of "just in case" shoes, and the full-size shampoo.`,
      },
      {
        title: "Winter trains in Scandinavia: how to book cheap seats",
        slug: "scandinavian-winter-trains",
        excerpt: "When tickets open, which passes still pay off, and where night trains make sense.",
        status: "DRAFT",
        categoryId: practical.id,
        tags: ["trains", "budget"],
        seoTitle: "",
        seoDescription: "",
        publishedDaysAgo: 0,
        content: `# Winter trains in Scandinavia

Draft outline: booking windows, night trains, passes.`,
      },
    ];

    for (const [index, article] of articles.entries()) {
      const publishedAt =
        article.status === "PUBLISHED"
          ? new Date(Date.now() - article.publishedDaysAgo * 86_400_000)
          : null;
      const wordCount = article.content.trim().split(/\s+/).length;

      await db.article.upsert({
        where: { siteId_slug: { siteId: site.id, slug: article.slug } },
        update: {},
        create: {
          siteId: site.id,
          categoryId: article.categoryId,
          title: article.title,
          slug: article.slug,
          excerpt: article.excerpt,
          content: article.content,
          status: article.status,
          tags: article.tags,
          author: "Demo Explorer",
          language: "en",
          seoTitle: article.seoTitle,
          seoDescription: article.seoDescription,
          wordCount,
          publishedAt,
          scheduledAt:
            article.status === "PUBLISHED" ? null : new Date(Date.now() + (index + 1) * 86_400_000),
        },
      });
    }

    // --- agent history (clearly marked as demo) ---------------------------
    const now = Date.now();
    const demoTask = await db.agentTask.create({
      data: {
        siteId: site.id,
        type: "GENERATE_ARTICLE",
        status: "COMPLETED",
        input: { title: "Chasing the northern lights from Tromsø" },
        output: { articleId: null },
        scheduledAt: new Date(now - 3 * 86_400_000),
        startedAt: new Date(now - 3 * 86_400_000),
        completedAt: new Date(now - 3 * 86_400_000 + 96_000),
      },
    });

    await db.agentRun.createMany({
      data: [
        {
          siteId: site.id,
          taskId: demoTask.id,
          agent: "research",
          model: "demo",
          status: "SUCCESS",
          startedAt: new Date(now - 3 * 86_400_000),
          finishedAt: new Date(now - 3 * 86_400_000 + 12_000),
          durationMs: 12_000,
          promptTokens: 820,
          outputTokens: 0,
          inputSummary: "aurora Tromsø viewpoints",
          outputSummary: "Collected 8 source snippets",
          isDemo: true,
        },
        {
          siteId: site.id,
          taskId: demoTask.id,
          agent: "writer",
          model: "demo",
          status: "SUCCESS",
          startedAt: new Date(now - 3 * 86_400_000 + 12_000),
          finishedAt: new Date(now - 3 * 86_400_000 + 74_000),
          durationMs: 62_000,
          promptTokens: 2_400,
          outputTokens: 1_450,
          inputSummary: "Draft aurora guide",
          outputSummary: "Wrote 820-word article",
          isDemo: true,
        },
        {
          siteId: site.id,
          taskId: demoTask.id,
          agent: "seo",
          model: "demo",
          status: "SUCCESS",
          startedAt: new Date(now - 3 * 86_400_000 + 74_000),
          finishedAt: new Date(now - 3 * 86_400_000 + 96_000),
          durationMs: 22_000,
          promptTokens: 900,
          outputTokens: 320,
          inputSummary: "SEO pass: title, description",
          outputSummary: "Set seoTitle and seoDescription",
          isDemo: true,
        },
      ],
    });

    await db.agentTask.create({
      data: {
        siteId: site.id,
        type: "GENERATE_ARTICLE",
        status: "QUEUED",
        input: { title: "Packing for the Arctic: the list we actually use" },
        scheduledAt: new Date(now + 18 * 60 * 60 * 1000),
      },
    });

    await db.usageEvent.createMany({
      data: [
        { siteId: site.id, organizationId: organization.id, agent: "writer", model: "demo", taskType: "GENERATE_ARTICLE", promptTokens: 2_400, outputTokens: 1_450, costUsd: 0.01, createdAt: new Date(now - 3 * 86_400_000) },
        { siteId: site.id, organizationId: organization.id, agent: "seo", model: "demo", taskType: "SEO_AUDIT", promptTokens: 900, outputTokens: 320, costUsd: 0.003, createdAt: new Date(now - 2 * 86_400_000) },
        { siteId: site.id, organizationId: organization.id, agent: "editor", model: "demo", taskType: "EDIT_ARTICLE", promptTokens: 1_600, outputTokens: 700, costUsd: 0.006, createdAt: new Date(now - 1 * 86_400_000) },
      ],
    });

    // --- one honest, unresolved SEO issue ---------------------------------
    await db.seoIssue.create({
      data: {
        siteId: site.id,
        type: "missing_description",
        severity: "warning",
        message: "The Contact page has no meta description.",
      },
    });

    // --- demo analytics (source = "demo") ---------------------------------
    for (let days = 29; days >= 0; days--) {
      const date = new Date();
      date.setUTCHours(0, 0, 0, 0);
      date.setUTCDate(date.getUTCDate() - days);
      const wave = Math.sin(days / 3.5);
      const pageViews = Math.max(6, Math.round(40 + wave * 18 + ((days * 7) % 11)));
      const visits = Math.round(pageViews * 0.6);
      const existing = await db.analyticsDaily.findFirst({
        where: { siteId: site.id, articleId: null, date },
      });
      if (existing) {
        await db.analyticsDaily.update({
          where: { id: existing.id },
          data: { pageViews, visits, source: "demo" },
        });
      } else {
        await db.analyticsDaily.create({
          data: { siteId: site.id, date, pageViews, visits, source: "demo" },
        });
      }
    }

    console.log("[seed] demo data ready");
    console.log(`[seed]   login:    ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
    console.log(`[seed]   site:     ${site.name} (isDemo=true)`);
    console.log("[seed]   everything above is clearly marked as demo data");
  } catch (error) {
    console.error("[seed] failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await db.$disconnect().catch(() => undefined);
  }
}

main();
