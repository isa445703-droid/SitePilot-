import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/prisma";
import { handleApi, enforceRateLimit, readJson, requireApiUser } from "@/lib/api/http";
import { enqueueTask, runTask, taskInputSchemas } from "@/lib/agents/orchestrator";
import { getOwnedSite } from "@/lib/auth/guards";

const createSchema = z.object({
  siteId: z.string().min(1),
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
 * POST /api/tasks — cross-site task creation (same validation contract as the
 * per-site route). Used by the dashboard quick actions.
 */
export async function POST(req: NextRequest) {
  return handleApi(async () => {
    // `runNow` executes the task inline — keep this endpoint cheap to hammer.
    enforceRateLimit(req, "tasks", 30, 60_000);
    const user = await requireApiUser();
    const body = createSchema.parse(await readJson(req));

    const site = await getOwnedSite(body.siteId, user.id);
    if (!site) throw Object.assign(new Error("Site not found"), { status: 404, code: "NOT_FOUND" });

    taskInputSchemas[body.type].parse(body.input);
    const task = await enqueueTask({
      siteId: body.siteId,
      type: body.type as never,
      input: body.input,
      scheduledAt: body.scheduledAt,
    });

    const outcome = body.runNow ? await runTask(task.id) : null;
    return { task, outcome };
  });
}

/** GET /api/tasks — queued/running tasks across accessible sites. */
export async function GET() {
  return handleApi(async () => {
    const user = await requireApiUser();
    const memberships = await db.orgMember.findMany({ where: { userId: user.id } });
    if (memberships.length === 0) return [];
    const sites = await db.site.findMany({
      where: { organizationId: { in: memberships.map((m) => m.organizationId) } },
      select: { id: true },
    });
    if (sites.length === 0) return [];
    return db.agentTask.findMany({
      where: { siteId: { in: sites.map((s) => s.id) }, status: { in: ["QUEUED", "RUNNING"] } },
      orderBy: [{ priority: "desc" }, { scheduledAt: "asc" }],
      take: 30,
      include: { site: { select: { id: true, name: true } } },
    });
  });
}
