import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { enforceRateLimit, handleApi, readJson } from "@/lib/api/http";
import { logger } from "@/lib/logger";

const signupSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(200),
  password: z.string().min(8, "At least 8 characters").max(200),
  name: z.string().trim().min(1, "Enter your name").max(120),
  locale: z.string().max(10).optional(),
});

export async function POST(req: NextRequest) {
  return handleApi(async () => {
    enforceRateLimit(req, "signup", 10, 60_000);
    const input = signupSchema.parse(await readJson(req));

    const existing = await db.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw Object.assign(new Error("An account with this email already exists."), {
        status: 409,
        code: "EMAIL_TAKEN",
      });
    }

    const user = await db.user.create({
      data: {
        email: input.email,
        name: input.name,
        passwordHash: await hashPassword(input.password),
        locale: input.locale ?? "en",
        memberships: {
          create: {
            organization: {
              create: { name: `${input.name}'s workspace`, slug: `ws-${Date.now().toString(36)}` },
            },
            role: "OWNER",
          },
        },
      },
      include: { memberships: true },
    });

    await createSession({
      id: user.id,
      email: user.email,
      name: user.name,
      locale: user.locale,
      theme: user.theme,
    });

    logger.info("user_signed_up", { userId: user.id });
    return { userId: user.id, email: user.email, name: user.name };
  });
}
