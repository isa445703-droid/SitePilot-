import { NextRequest } from "next/server";
import { z } from "zod";
import { handleApi, readJson, requireApiUser } from "@/lib/api/http";
import { listTasks } from "@/lib/services/activity";
import { enqueueTask, runTask, taskInputSchemas } from "@/lib/agents/orchestrator";
import { getOwnedSite } from "@/lib/auth/guards";
import { logger } from "@/lib/logger";

type Params = { params: Promise<{ siteId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  return handleApi(async () => {
    const user = await requireApiUser();
    const { siteId } = await params;
    const url = new URL(req.url);
    const tasks = await listTasks(user.id, {
      siteId,
      status: url.searchParams.get("status") ?? undefined,
      take: 100,
    });
    if (tasks.length === 0) {
      const site = await getOwnedSite(siteId, user.id);
      if (!site) throw Object.assign(new Error("Site not found"), { status: 404, code: "NOT_FOUND" });
    }
    return tasks;
  });
}

const createSchema = z.object({
  type: z.enum([
    "GENERATE_ARTICLE",
    "RESEARCH_TOPIC",
    "SEO_AUDIT",
    "ANALYZE_SITE",
    "GENERATE_CONTENT_PLAN",
    "GENERATE_PAGES",
    "UPDATE_ARTICLE",
    "EDIT_ARTICLE",
    "PUBLISH_ARTICLE",
  ]),
  input: z.record(z.unknown()).default({}),
  runNow: z.boolean().default(false),
  scheduledAt: z.coerce.date().optional(),
});

/**
 * POST /api/sites/:siteId/tasks
 * Task creation is only exposed for the operations the product itself needs
 * (queued by the UI or the scheduler); inputs are validated by the task's
 * Zod contract before anything runs.
 */
export async function POST(req: NextRequest, { params }: Params) {
  return handleApi(async () => {
    const user = await requireApiUser();
    const { siteId } = await params;
    const site = await getOwnedSite(siteId, user.id);
    if (!site) throw Object.assign(new Error("Site not found"), { status: 404, code: "NOT_FOUND" });

    const body = createSchema.parse(await readJson(req));
    // Validate the payload against the task contract before queueing it.
    taskInputSchemas[body.type].parse(body.input);

    const task = await enqueueTask({
      siteId,
      type: body.type as never,
      input: body.input,
      scheduledAt: body.scheduledAt,
    });

    let outcome = null;
    if (body.runNow) outcome = await runTask(task.id);
    logger.info("task_created", { siteId, userId: user.id, taskType: body.type, runNow: body.runNow });

    return { task, outcome };
  });
}
