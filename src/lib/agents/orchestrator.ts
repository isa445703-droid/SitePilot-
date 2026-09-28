import "server-only";
import { z } from "zod";
import { db } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";
import { generateBlueprint, generateContentPlan } from "@/lib/ai";
import type { Blueprint } from "@/lib/ai/schemas";
import { slugify, uniqueSlug } from "@/lib/utils/slug";
import { throwAgentFailure, withAgentRun } from "./run";
import { runAnalyticsAgent } from "./analytics";
import { runEditorAgent } from "./editor";
import { runPagesAgent } from "./pages";
import { runPublisherAgent } from "./publisher";
import { runResearchAgent } from "./research";
import { runSeoAgent, runSeoAudit } from "./seo";
import { runWriterAgent } from "./writer";
import { assertPermission } from "./permissions";
import { loadSiteBundle } from "./context";
import { MAX_TASK_ATTEMPTS, isRetryableTaskError, retryDelayMs } from "./task-policy";
import { scheduleNextPublication } from "@/lib/scheduler";

/* -------------------------------------------------------------------------- */
/* Task input contracts — validated before anything executes                  */
/* -------------------------------------------------------------------------- */

export const taskInputSchemas = {
  GENERATE_BLUEPRINT: z.object({
    brief: z.string().min(1).max(4000),
    siteName: z.string().max(120).optional(),
    language: z.string().min(2).max(10),
  }),
  GENERATE_CONTENT_PLAN: z.object({
    count: z.number().int().min(1).max(20).default(9),
    queueArticles: z.boolean().default(false),
    initial: z.boolean().default(false),
  }),
  GENERATE_PAGES: z.object({}).default({}),
  RESEARCH_TOPIC: z.object({
    topic: z.string().min(1).max(300),
    articleId: z.string().optional(),
  }),
  GENERATE_ARTICLE: z.object({
    title: z.string().min(1).max(200),
    category: z.string().max(80).optional(),
    categoryId: z.string().optional(),
    keywords: z.array(z.string().max(80)).max(10).optional(),
    instruction: z.string().max(1000).optional(),
    initial: z.boolean().default(false),
    research: z.boolean().default(true),
  }),
  EDIT_ARTICLE: z.object({
    articleId: z.string().min(1),
    mode: z.enum(["improve", "rewrite", "edit"]).default("improve"),
    instruction: z.string().max(1000).optional(),
  }),
  UPDATE_ARTICLE: z.object({
    articleId: z.string().min(1),
    instruction: z.string().max(1000).optional(),
    refreshSeo: z.boolean().default(true),
  }),
  SEO_AUDIT: z.object({
    fix: z.boolean().default(false),
  }),
  PUBLISH_ARTICLE: z.object({
    articleId: z.string().min(1),
    action: z.enum(["publish", "unpublish", "approve"]).default("publish"),
  }),
  ANALYZE_SITE: z.object({}).default({}),
} as const;

export type TaskType = keyof typeof taskInputSchemas;

function parseTaskInput<T extends TaskType>(
  type: T,
  input: unknown,
): z.infer<(typeof taskInputSchemas)[T]> {
  return taskInputSchemas[type].parse(input ?? {});
}

/* -------------------------------------------------------------------------- */
/* Site provisioning from an approved blueprint                               */
/* -------------------------------------------------------------------------- */

export type ProvisionResult = {
  categories: number;
  pages: number;
  taskIds: string[];
};

/**
 * Creates the structural part of a site (categories, pages, brand, design,
 * settings, schedule) and queues the first tasks. The blueprint itself is
 * already Zod-validated by the caller.
 */
export async function provisionSiteFromBlueprint(
  siteId: string,
  blueprint: Blueprint,
  options: { timezone?: string } = {},
): Promise<ProvisionResult> {
  const site = await db.site.findUnique({ where: { id: siteId } });
  if (!site) throw new Error("Site not found");

  const categories: string[] = [];
  for (const [index, category] of blueprint.categories.entries()) {
    const slug = uniqueSlug(
      slugify(category.name, `category-${index + 1}`),
      categories,
    );
    categories.push(slug);
    await db.category.create({
      data: {
        siteId,
        name: category.name,
        slug,
        description: category.description,
        order: index,
      },
    });
  }

  const pages: string[] = [];
  for (const [index, page] of blueprint.pages.entries()) {
    const slug = index === 0 ? "" : uniqueSlug(slugify(page.slug || page.title, "page"), pages);
    pages.push(slug);
    await db.page.create({
      data: {
        siteId,
        title: page.title,
        slug,
        type: index === 0 ? "HOME" : page.slug === "about" ? "ABOUT" : page.slug === "contact" ? "CONTACT" : "CUSTOM",
        status: "PUBLISHED",
        content: [
          { type: "heading", level: 1, text: page.title },
          { type: "paragraph", text: page.purpose || blueprint.description },
        ] as any,
        seoTitle: page.title.slice(0, 60),
        seoDescription: (page.purpose || blueprint.description).slice(0, 155),
        order: index,
      },
    });
  }

  const brand = blueprint.tone || "";
  await db.siteBrand.upsert({
    where: { siteId },
    create: {
      siteId,
      brandVoice: brand,
      tone: brand,
      guidelines: `${blueprint.description}`,
      keywords: blueprint.seoStrategy.keywords,
      audienceNotes: blueprint.targetAudience,
    },
    update: {
      brandVoice: brand,
      tone: brand,
      guidelines: `${blueprint.description}`,
      keywords: blueprint.seoStrategy.keywords,
      audienceNotes: blueprint.targetAudience,
    },
  });

  const design = blueprint.design;
  await db.siteDesign.upsert({
    where: { siteId },
    create: {
      siteId,
      primaryColor: design.primaryColor,
      secondaryColor: design.secondaryColor,
      surfaceColor: design.surfaceColor,
      backgroundColor: design.backgroundColor,
      textColor: design.textColor,
      mutedColor: design.mutedColor,
      fontStyle: design.fontStyle,
      layoutStyle: design.layoutStyle,
      cardStyle: design.cardStyle,
      borderRadius: design.borderRadius,
      headerStyle: design.headerStyle,
      heroStyle: design.heroStyle,
      cardDensity: design.cardDensity,
    },
    update: {},
  });

  await db.siteSettings.upsert({
    where: { siteId },
    create: {
      siteId,
      siteTitle: blueprint.siteName,
      metaDescription: blueprint.description.slice(0, 155),
    },
    update: {
      siteTitle: blueprint.siteName,
      metaDescription: blueprint.description.slice(0, 155),
    },
  });

  await db.publishingSchedule.upsert({
    where: { siteId },
    create: {
      siteId,
      frequency: blueprint.publishingFrequency,
      timezone: options.timezone || site.timezone || "UTC",
      publishHour: site.publishHour ?? 9,
      enabled: false,
    },
    update: {
      frequency: blueprint.publishingFrequency,
      timezone: options.timezone || site.timezone || undefined,
    },
  });

  const planTask = await db.agentTask.create({
    data: {
      siteId,
      type: "GENERATE_CONTENT_PLAN",
      status: "QUEUED",
      scheduledAt: new Date(),
      input: { count: 9, queueArticles: false, initial: true } as any,
      priority: 10,
    },
  });

  const pagesTask = await db.agentTask.create({
    data: {
      siteId,
      type: "GENERATE_PAGES",
      status: "QUEUED",
      scheduledAt: new Date(),
      input: {} as any,
      priority: 15,
    },
  });

  await db.site.update({
    where: { id: siteId },
    data: {
      name: blueprint.siteName,
      description: blueprint.description,
      targetAudience: blueprint.targetAudience,
      primaryGoal: blueprint.primaryGoal,
      language: blueprint.language,
      tone: blueprint.tone,
      frequency: blueprint.publishingFrequency,
      status: "BUILDING",
    },
  });

  return { categories: categories.length, pages: pages.length, taskIds: [planTask.id, pagesTask.id] };
}

/* -------------------------------------------------------------------------- */
/* Task execution                                                             */
/* -------------------------------------------------------------------------- */

export type TaskOutcome = {
  taskId: string;
  ok: boolean;
  output?: unknown;
  error?: string;
  /** Set when the failure came from a typed AI/API error (429/502/503). */
  status?: number;
  code?: string;
  /** Set when the task was put back into the queue for another attempt. */
  willRetry?: boolean;
  attempts?: number;
  /**
   * Set when we lost the atomic claim to a concurrent runner (API-triggered run
   * vs scheduler tick). Nothing went wrong, so callers must not count it as a
   * failure — the other runner owns the task now.
   */
  skipped?: boolean;
};

/** Claims per task before it is failed for good. */
export { MAX_TASK_ATTEMPTS, isRetryableTaskError, retryDelayMs } from "./task-policy";

/**
 * Executes one queued task. The orchestrator only ever runs validated data
 * through a fixed dispatch table — it never executes anything the model produced.
 *
 * Transient failures are re-queued with backoff until `MAX_TASK_ATTEMPTS` is
 * reached; the atomic claim below keeps concurrent ticks from double-running.
 */
export async function runTask(taskId: string): Promise<TaskOutcome> {
  const task = await db.agentTask.findUnique({ where: { id: taskId } });
  if (!task) {
    logger.warn("task_missing", { taskId });
    return { taskId, ok: false, error: "Task not found" };
  }

  const claimed = await db.agentTask.updateMany({
    where: { id: taskId, status: "QUEUED" },
    data: { status: "RUNNING", startedAt: new Date(), attempts: { increment: 1 } },
  });
  if (claimed.count === 0) {
    const current = await db.agentTask.findUnique({ where: { id: taskId } });
    const status = current?.status ?? "unknown";
    // Expected whenever a tick overlaps an API-triggered run: the claim is the
    // guard, this is just the loser reporting in instead of failing the task.
    logger.info("task_claim_miss", { taskId, status });
    return { taskId, ok: false, skipped: true, error: `Task is ${status}` };
  }

  const attempts = (task.attempts ?? 0) + 1;

  try {
    const output = await dispatch(task.type as TaskType, task.siteId, taskId, task.input);
    await db.agentTask.update({
      where: { id: taskId },
      data: { status: "COMPLETED", completedAt: new Date(), output: output as any, error: null },
    });
    logger.info("task_completed", { taskId, siteId: task.siteId, taskType: task.type, attempts });
    return { taskId, ok: true, output, attempts };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500);
    const typed = error as { status?: unknown; code?: unknown };
    const status = typeof typed.status === "number" ? typed.status : undefined;
    const code = typeof typed.code === "string" ? typed.code : undefined;
    const willRetry = attempts < MAX_TASK_ATTEMPTS && isRetryableTaskError(error);

    await db.agentTask.update({
      where: { id: taskId },
      data: willRetry
        ? { status: "QUEUED", scheduledAt: new Date(Date.now() + retryDelayMs(attempts)), error: message }
        : { status: "FAILED", completedAt: new Date(), error: message },
    });
    logger.error("task_failed", {
      taskId,
      siteId: task.siteId,
      taskType: task.type,
      error: message,
      attempts,
      willRetry,
    });
    return {
      taskId,
      ok: false,
      error: message,
      attempts,
      ...(willRetry ? { willRetry: true } : {}),
      ...(status ? { status } : {}),
      ...(code ? { code } : {}),
    };
  }
}

async function dispatch(
  type: TaskType,
  siteId: string,
  taskId: string,
  rawInput: unknown,
): Promise<unknown> {
  const input = parseTaskInput(type, rawInput);

  switch (type) {
    case "GENERATE_BLUEPRINT": {
      const parsed = input as z.infer<typeof taskInputSchemas.GENERATE_BLUEPRINT>;
      const outcome = await generateBlueprint({
        brief: parsed.brief,
        siteName: parsed.siteName,
        language: parsed.language,
      });
      await db.site.update({
        where: { id: siteId },
        data: { blueprint: outcome.data as any },
      });
      return { blueprint: outcome.data, isDemo: outcome.isDemo };
    }

    case "GENERATE_CONTENT_PLAN": {
      const parsed = input as z.infer<typeof taskInputSchemas.GENERATE_CONTENT_PLAN>;
      const bundle = await loadSiteBundle("orchestrator", siteId);

      const outcome = await withAgentRun(
        {
          agent: "orchestrator",
          siteId,
          taskId,
          input: { action: "generate_content_plan", count: parsed.count },
          output: (o: any) => `${o.items?.length ?? 0} ideas`,
        },
        async (ctx) => {
          const plan = await generateContentPlan({
            siteName: bundle.site.name,
            language: bundle.site.language,
            audience: bundle.site.targetAudience,
            keywords: bundle.brand?.keywords ?? [],
            categories: bundle.categories.map((c: any) => c.name),
            count: parsed.count,
          });
          ctx.recordUsage(plan.usage);
          ctx.setDemo(plan.isDemo);
          return plan;
        },
      );
      if (!outcome.ok) throwAgentFailure(outcome);

      const items = outcome.value.data.items;
      const taskIds: string[] = [];

      if (parsed.queueArticles || parsed.initial) {
        const limit = parsed.initial ? 3 : Math.min(items.length, 3);
        for (const [index, item] of items.slice(0, limit).entries()) {
          const category = bundle.categories.find(
            (c: any) => c.name.toLowerCase() === item.category.toLowerCase(),
          );
          const created = await db.agentTask.create({
            data: {
              siteId,
              type: "GENERATE_ARTICLE",
              status: "QUEUED",
              priority: 20 + index,
              scheduledAt: new Date(Date.now() + index * 5_000),
              input: {
                title: item.title,
                category: item.category,
                categoryId: category?.id,
                keywords: item.keywords,
                initial: parsed.initial,
                research: true,
              } as any,
            },
          });
          taskIds.push(created.id);
        }
      }

      return { items, isDemo: outcome.isDemo, queuedArticleTasks: taskIds };
    }

    case "GENERATE_ARTICLE": {
      const parsed = input as z.infer<typeof taskInputSchemas.GENERATE_ARTICLE>;
      const bundle = await loadSiteBundle("orchestrator", siteId);

      // 1) Research
      let researchText = "";
      let researchId: string | undefined;
      if (parsed.research) {
        const research = await runResearchAgent({ siteId, taskId, topic: parsed.title });
        if (research.ok) {
          researchId = research.value.researchId;
          const notes = await db.researchItem.findUnique({ where: { id: research.value.researchId } });
          const notesList = (notes?.notes as Array<{ title: string; detail: string; isFact?: boolean }>) ?? [];
          researchText = notesList
            .map((n) => `- ${n.title}: ${n.detail}${n.isFact ? " (fact)" : " (assumption)"}`)
            .join("\n");
        }
      }

      // 2) Write
      const category =
        bundle.categories.find((c: any) => c.id === parsed.categoryId) ??
        bundle.categories.find((c: any) => c.name === parsed.category);
      const written = await runWriterAgent({
        siteId,
        taskId,
        title: parsed.title,
        categoryId: parsed.categoryId ?? category?.id ?? null,
        category: parsed.category ?? category?.name,
        keywords: parsed.keywords,
        instruction: parsed.instruction,
        researchText,
        status: parsed.initial ? "PUBLISHED" : "DRAFT",
      });
      if (!written.ok) throw new Error(written.error);
      const articleId = written.value.articleId;

      if (researchId) {
        await db.researchItem
          .update({ where: { id: researchId }, data: { articleId } })
          .catch(() => undefined);
      }

      // 3) Edit
      const edited = await runEditorAgent({
        siteId,
        taskId,
        articleId,
        mode: "improve",
        instruction: parsed.instruction,
      });

      // 4) SEO
      const seo = await runSeoAgent({ siteId, taskId, articleId, mode: "initial" });

      // 5) Publish according to the autopilot mode
      let finalStatus = "DRAFT";
      if (parsed.initial) {
        const published = await runPublisherAgent({ siteId, taskId, articleId, action: "publish" });
        if (published.ok) finalStatus = published.value.status;
      } else if (bundle.site.autopilot === "FULL") {
        const published = await runPublisherAgent({ siteId, taskId, articleId, action: "publish" });
        if (published.ok) finalStatus = published.value.status;
      } else if (bundle.site.autopilot === "REVIEW") {
        await db.article.update({ where: { id: articleId }, data: { status: "REVIEW" } });
        finalStatus = "REVIEW";
      }

      return {
        articleId,
        title: written.value.title,
        status: finalStatus,
        researched: Boolean(researchId),
        edited: edited.ok,
        seoApplied: seo.ok,
        demo: written.value.isDemo,
      };
    }

    case "GENERATE_PAGES": {
      const result = await runPagesAgent({ siteId, taskId });
      if (!result.ok) throwAgentFailure(result);
      return result.value;
    }

    case "RESEARCH_TOPIC": {
      const parsed = input as z.infer<typeof taskInputSchemas.RESEARCH_TOPIC>;
      const result = await runResearchAgent({
        siteId,
        taskId,
        topic: parsed.topic,
        articleId: parsed.articleId,
      });
      if (!result.ok) throwAgentFailure(result);
      return result.value;
    }

    case "EDIT_ARTICLE": {
      const parsed = input as z.infer<typeof taskInputSchemas.EDIT_ARTICLE>;
      const result = await runEditorAgent({
        siteId,
        taskId,
        articleId: parsed.articleId,
        mode: parsed.mode,
        instruction: parsed.instruction,
      });
      if (!result.ok) throwAgentFailure(result);
      return result.value;
    }

    case "UPDATE_ARTICLE": {
      const parsed = input as z.infer<typeof taskInputSchemas.UPDATE_ARTICLE>;
      const edited = await runEditorAgent({
        siteId,
        taskId,
        articleId: parsed.articleId,
        mode: "edit",
        instruction: parsed.instruction,
      });
      if (!edited.ok) throw new Error(edited.error);
      let seo = null;
      if (parsed.refreshSeo) {
        const result = await runSeoAgent({ siteId, taskId, articleId: parsed.articleId });
        seo = result.ok ? result.value : { error: result.error };
      }
      return { edited: edited.value, seo };
    }

    case "SEO_AUDIT": {
      const parsed = input as z.infer<typeof taskInputSchemas.SEO_AUDIT>;
      const result = await runSeoAudit({ siteId, taskId, fix: parsed.fix });
      if (!result.ok) throwAgentFailure(result);
      return result.value;
    }

    case "PUBLISH_ARTICLE": {
      const parsed = input as z.infer<typeof taskInputSchemas.PUBLISH_ARTICLE>;
      const result = await runPublisherAgent({
        siteId,
        taskId,
        articleId: parsed.articleId,
        action: parsed.action,
      });
      if (!result.ok) throwAgentFailure(result);
      return result.value;
    }

    case "ANALYZE_SITE": {
      const result = await runAnalyticsAgent({ siteId, taskId });
      if (!result.ok) throwAgentFailure(result);
      return result.value;
    }

    default: {
      const exhaustive: never = type;
      throw new Error(`Unknown task type: ${String(exhaustive)}`);
    }
  }
}

/** Creates a queued task (used by services, scheduler and the orchestrator). */
export async function enqueueTask(input: {
  siteId: string;
  type: TaskType;
  input?: Record<string, unknown>;
  scheduledAt?: Date;
  priority?: number;
}) {
  assertPermission("orchestrator", "create_tasks");
  return db.agentTask.create({
    data: {
      siteId: input.siteId,
      type: input.type,
      status: "QUEUED",
      scheduledAt: input.scheduledAt ?? new Date(),
      priority: input.priority ?? 100,
      input: (input.input ?? {}) as any,
    },
  });
}

/** Keeps the autopilot loop fed: queues the next publication when needed. */
export async function maintainSchedule(siteId: string): Promise<string | null> {
  const site = await db.site.findUnique({
    where: { id: siteId },
    include: { schedule: true },
  });
  if (!site?.schedule?.enabled || site.autopilot === "MANUAL") return null;

  const queued = await db.agentTask.count({
    where: { siteId, type: "GENERATE_ARTICLE", status: { in: ["QUEUED", "RUNNING"] } },
  });
  if (queued > 0) return null;

  const next = await scheduleNextPublication(siteId);
  return next?.taskId ?? null;
}

export { runSeoAudit, runSeoAgent, runPublisherAgent, runEditorAgent, runWriterAgent, runResearchAgent, runPagesAgent };
