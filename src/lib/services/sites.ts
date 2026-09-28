import "server-only";
import { z } from "zod";
import { db } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";
import { generateBlueprint } from "@/lib/ai";
import { blueprintDesignSchema, blueprintSchema, type Blueprint } from "@/lib/ai/schemas";
import { throwAgentFailure, withAgentRun } from "@/lib/agents/run";
import { provisionSiteFromBlueprint } from "@/lib/agents/orchestrator";
import { getOwnedSite } from "@/lib/auth/guards";
import { slugify, uniqueSlug } from "@/lib/utils/slug";
import type { Locale } from "@/lib/i18n/config";

/* -------------------------------------------------------------------------- */
/* Validation contracts                                                       */
/* -------------------------------------------------------------------------- */

export const createSiteSchema = z.object({
  brief: z.string().trim().min(20, "Describe the site in at least 20 characters").max(4000),
  name: z.string().trim().max(120).optional(),
  designBrief: z.string().trim().max(2000).optional(),
  language: z.string().trim().min(2).max(10).default("en"),
  timezone: z.string().max(64).default("UTC"),
});

export const updateSiteSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(1200).optional(),
  targetAudience: z.string().trim().max(600).optional(),
  primaryGoal: z.string().trim().max(400).optional(),
  tone: z.string().trim().max(200).optional(),
  language: z.string().trim().min(2).max(10).optional(),
  timezone: z.string().trim().max(64).optional(),
  publishHour: z.number().int().min(0).max(23).optional(),
  frequency: z
    .enum(["ONCE_A_WEEK", "TWICE_A_WEEK", "THREE_A_WEEK", "FIVE_A_WEEK", "DAILY"])
    .optional(),
  indexable: z.boolean().optional(),
  siteTitle: z.string().trim().max(70).optional(),
  metaDescription: z.string().trim().max(180).optional(),
  brandVoice: z.string().trim().max(2000).optional(),
  keywords: z.array(z.string().max(80)).max(30).optional(),
  // New design fields are optional so clients on an older payload still save.
  design: blueprintDesignSchema.partial().optional(),
});

export type CreateSiteInput = z.infer<typeof createSiteSchema>;
export type UpdateSiteInput = z.infer<typeof updateSiteSchema>;

/* -------------------------------------------------------------------------- */
/* Create + blueprint                                                         */
/* -------------------------------------------------------------------------- */

export async function createSiteForUser(input: {
  userId: string;
  organizationId: string;
  input: CreateSiteInput;
}) {
  const baseName = input.input.name?.trim() || deriveWorkingName(input.input.brief);
  const taken = await db.site.findMany({
    where: { organizationId: input.organizationId },
    select: { slug: true },
  });
  const slug = uniqueSlug(slugify(baseName, "site"), taken.map((s) => s.slug));

  return db.site.create({
    data: {
      organizationId: input.organizationId,
      name: baseName,
      slug,
      brief: input.input.brief,
      designBrief: input.input.designBrief ?? "",
      language: input.input.language,
      timezone: input.input.timezone,
      status: "DRAFT",
      autopilot: "MANUAL",
      frequency: "THREE_A_WEEK",
      createdById: input.userId,
    },
  });
}

function deriveWorkingName(brief: string): string {
  const words = brief.trim().split(/\s+/).slice(0, 4).join(" ").replace(/[.,;:!?]+$/, "");
  return (words || "New website").replace(/^./, (c) => c.toUpperCase()).slice(0, 120);
}

/**
 * Generates (or regenerates) the blueprint for a site. Every call creates an
 * AgentRun row, the output is Zod-validated, and the result is stored on the
 * site as `blueprint` — the UI shows it for review/editing before provisioning.
 */
export async function generateSiteBlueprint(input: {
  siteId: string;
  userId: string;
  brief: string;
  siteName?: string;
  language: string;
  timezone?: string;
  designBrief?: string;
}) {
  const site = await getOwnedSite(input.siteId, input.userId);
  if (!site) throw new Error("Forbidden");

  const run = await withAgentRun(
    {
      agent: "orchestrator",
      siteId: input.siteId,
      input: { action: "generate_blueprint", brief: input.brief.slice(0, 400) },
      output: (o: any) => `${o.data?.categories?.length ?? 0} categories`,
    },
    async (ctx) => {
      const outcome = await generateBlueprint({
        brief: input.brief,
        siteName: input.siteName,
        language: input.language,
        timezone: input.timezone,
        designBrief: input.designBrief ?? site.designBrief,
      });
      ctx.recordUsage(outcome.usage);
      ctx.setDemo(outcome.isDemo);
      return outcome;
    },
  );

  if (!run.ok) throwAgentFailure(run);

  const blueprint = run.value.data;
  await db.site.update({
    where: { id: input.siteId },
    data: { blueprint: blueprint as any, updatedAt: new Date() },
  });

  logger.info("blueprint_generated", {
    siteId: input.siteId,
    userId: input.userId,
    isDemo: run.value.isDemo,
    runId: run.runId,
  });

  return { blueprint, isDemo: run.value.isDemo, runId: run.runId };
}

/** Stores a blueprint that the user edited by hand (still validated). */
export async function saveBlueprint(input: {
  siteId: string;
  userId: string;
  blueprint: unknown;
}): Promise<Blueprint> {
  const site = await getOwnedSite(input.siteId, input.userId);
  if (!site) throw new Error("Forbidden");
  const parsed = blueprintSchema.parse(input.blueprint);
  await db.site.update({
    where: { id: input.siteId },
    data: { blueprint: parsed as any, updatedAt: new Date() },
  });
  return parsed;
}

/** Approves the blueprint and builds the site structure + first tasks. */
export async function provisionSite(input: { siteId: string; userId: string; timezone?: string }) {
  const site = await getOwnedSite(input.siteId, input.userId);
  if (!site) throw new Error("Forbidden");
  if (!site.blueprint) throw new Error("No blueprint to approve yet.");

  const blueprint = blueprintSchema.parse(site.blueprint);
  const result = await provisionSiteFromBlueprint(input.siteId, blueprint, {
    timezone: input.timezone ?? site.timezone,
  });
  await db.site.update({
    where: { id: input.siteId },
    data: { status: "BUILDING", isDemo: site.isDemo },
  });
  return { ...result, blueprint };
}

/* -------------------------------------------------------------------------- */
/* Updates                                                                    */
/* -------------------------------------------------------------------------- */

export async function updateSite(input: {
  siteId: string;
  userId: string;
  data: UpdateSiteInput;
}) {
  const site = await getOwnedSite(input.siteId, input.userId);
  if (!site) throw new Error("Forbidden");

  const { data } = input;
  const siteData: Record<string, unknown> = {};
  for (const key of ["name", "description", "targetAudience", "primaryGoal", "tone", "language", "timezone", "publishHour", "frequency"] as const) {
    if (data[key] !== undefined) siteData[key] = data[key];
  }
  if (data.indexable !== undefined || data.siteTitle !== undefined || data.metaDescription !== undefined) {
    await db.siteSettings.upsert({
      where: { siteId: input.siteId },
      create: {
        siteId: input.siteId,
        indexable: data.indexable ?? true,
        siteTitle: data.siteTitle ?? "",
        metaDescription: data.metaDescription ?? "",
      },
      update: {
        ...(data.indexable !== undefined ? { indexable: data.indexable } : {}),
        ...(data.siteTitle !== undefined ? { siteTitle: data.siteTitle } : {}),
        ...(data.metaDescription !== undefined ? { metaDescription: data.metaDescription } : {}),
      },
    });
  }
  if (Object.keys(siteData).length > 0) {
    await db.site.update({ where: { id: input.siteId }, data: siteData });
  }

  if (data.brandVoice !== undefined || data.keywords !== undefined) {
    await db.siteBrand.upsert({
      where: { siteId: input.siteId },
      create: {
        siteId: input.siteId,
        brandVoice: data.brandVoice ?? "",
        keywords: data.keywords ?? [],
      },
      update: {
        ...(data.brandVoice !== undefined ? { brandVoice: data.brandVoice } : {}),
        ...(data.keywords !== undefined ? { keywords: data.keywords } : {}),
      },
    });
  }

  if (data.design) {
    await db.siteDesign.upsert({
      where: { siteId: input.siteId },
      create: { siteId: input.siteId, ...data.design },
      update: data.design,
    });
  }

  if (data.frequency || data.timezone || data.publishHour !== undefined) {
    const schedule = await db.publishingSchedule.findUnique({ where: { siteId: input.siteId } });
    if (schedule) {
      await db.publishingSchedule.update({
        where: { siteId: input.siteId },
        data: {
          ...(data.frequency ? { frequency: data.frequency } : {}),
          ...(data.timezone ? { timezone: data.timezone } : {}),
          ...(data.publishHour !== undefined ? { publishHour: data.publishHour } : {}),
        },
      });
    }
  }

  return db.site.findUnique({ where: { id: input.siteId } });
}

export async function deleteSite(input: { siteId: string; userId: string }) {
  const site = await getOwnedSite(input.siteId, input.userId);
  if (!site) throw new Error("Forbidden");
  // Deletion is a *user* action (never an agent action). Every Site relation
  // cascades in the Prisma schema; UsageEvent has no FK and is removed explicitly.
  await db.$transaction([
    db.usageEvent.deleteMany({ where: { siteId: input.siteId } }),
    db.site.delete({ where: { id: input.siteId } }),
  ]);
  logger.warn("site_deleted", { siteId: input.siteId, userId: input.userId });
  return { deleted: true };
}

/* -------------------------------------------------------------------------- */
/* Reads                                                                      */
/* -------------------------------------------------------------------------- */

export async function getSiteOverview(siteId: string, userId: string, locale: Locale) {
  const site = await getOwnedSite(siteId, userId);
  if (!site) return null;

  const [articles, published, queued, tasksDone, seoIssues, runs, schedule, brand, design, lastRun] =
    await Promise.all([
      db.article.count({ where: { siteId } }),
      db.article.count({ where: { siteId, status: "PUBLISHED" } }),
      db.agentTask.count({ where: { siteId, status: { in: ["QUEUED", "RUNNING"] } } }),
      db.agentTask.count({ where: { siteId, status: "COMPLETED" } }),
      db.seoIssue.count({ where: { siteId, resolved: false } }),
      db.agentRun.count({ where: { siteId } }),
      db.publishingSchedule.findUnique({ where: { siteId } }),
      db.siteBrand.findUnique({ where: { siteId } }),
      db.siteDesign.findUnique({ where: { siteId } }),
      db.agentRun.findFirst({
        where: { siteId },
        orderBy: { createdAt: "desc" },
      }),
    ]);

  return {
    site,
    schedule,
    brand,
    design,
    stats: {
      articles,
      published,
      queued,
      completedTasks: tasksDone,
      seoIssues,
      runs,
    },
    lastRun,
    locale,
  };
}
