import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { enforceRateLimit, handleApi, readJson } from "@/lib/api/http";
import { logger } from "@/lib/logger";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(1).max(200),
});

export async function POST(req: NextRequest) {
  return handleApi(async () => {
    enforceRateLimit(req, "login", 8, 60_000);
    const input = loginSchema.parse(await readJson(req));

    const user = await db.user.findUnique({ where: { email: input.email } });
    const ok = user ? await verifyPassword(input.password, user.passwordHash) : false;
    if (!ok || !user) {
      logger.warn("login_failed", { email: input.email });
      throw Object.assign(new Error("Wrong email or password."), {
        status: 401,
        code: "INVALID_CREDENTIALS",
      });
    }

    await createSession({
      id: user.id,
      email: user.email,
      name: user.name,
      locale: user.locale,
      theme: user.theme,
    });

    logger.info("user_logged_in", { userId: user.id });
    return { userId: user.id, email: user.email, name: user.name };
  });
}
