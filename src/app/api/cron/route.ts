import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";
import { schedulerTick } from "@/lib/scheduler";
import { handleApi } from "@/lib/api/http";

/**
 * /api/cron — external scheduler entry point.
 *
 * `POST` is the documented contract for external schedulers; `GET` exists
 * because Vercel Cron Jobs can only issue GET requests (Vercel sends
 * `Authorization: Bearer $CRON_SECRET` automatically when that variable is
 * set, which is exactly what the guard below expects).
 *
 * Requires `CRON_SECRET` (Authorization: Bearer …) unless running in
 * development. Runs one scheduler tick: due tasks + schedule maintenance.
 */
function authorize(req: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  const isDev = process.env.NODE_ENV !== "production";

  if (isDev) return null;

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

  return null;
}

async function tick(req: NextRequest) {
  const denied = authorize(req);
  if (denied) return denied;

  return handleApi(async () => {
    const started = Date.now();
    const result = await schedulerTick();
    const pending = await db.agentTask.count({ where: { status: { in: ["QUEUED", "RUNNING"] } } });
    logger.info("cron_tick", { status: "ok", durationMs: Date.now() - started, ...result, pending });
    return { ...result, pending, durationMs: Date.now() - started };
  });
}

export async function POST(req: NextRequest) {
  return tick(req);
}

/** Vercel Cron Jobs (see `crons` in vercel.json) only send GET. */
export async function GET(req: NextRequest) {
  return tick(req);
}
