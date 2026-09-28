import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";
import { schedulerTick } from "@/lib/scheduler";
import { handleApi } from "@/lib/api/http";

/**
 * POST /api/cron — external scheduler entry point.
 *
 * Requires `CRON_SECRET` (Authorization: Bearer …) unless running in
 * development. Runs one scheduler tick: due tasks + schedule maintenance.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const isDev = process.env.NODE_ENV !== "production";

  if (!isDev) {
    if (!secret) {
      return NextResponse.json(
        { ok: false, error: { code: "CRON_DISABLED", message: "CRON_SECRET is not configured." } },
        { status: 503 },
      );
    }
    const header = req.headers.get("authorization") ?? "";
    const provided = header.startsWith("Bearer ") ? header.slice(7) : req.headers.get("x-cron-secret") ?? "";
    if (provided !== secret) {
      logger.warn("cron_unauthorized", {});
      return NextResponse.json(
        { ok: false, error: { code: "UNAUTHORIZED", message: "Invalid cron secret." } },
        { status: 401 },
      );
    }
  }

  return handleApi(async () => {
    const started = Date.now();
    const result = await schedulerTick();
    const pending = await db.agentTask.count({ where: { status: { in: ["QUEUED", "RUNNING"] } } });
    logger.info("cron_tick", { status: "ok", durationMs: Date.now() - started, ...result, pending });
    return { ...result, pending, durationMs: Date.now() - started };
  });
}
