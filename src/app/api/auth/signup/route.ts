import { NextRequest } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { db } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { enforceRateLimit, handleApi, readJson } from "@/lib/api/http";
import { logger } from "@/lib/logger";
import { sendConfirmationEmail } from "@/lib/email";
import { env } from "@/lib/env";

const signupSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(200),
  password: z.string().min(8, "At least 8 characters").max(200),
  name: z.string().trim().min(1, "Enter your name").max(120),
  locale: z.string().max(10).optional(),
});

export async function POST(req: NextRequest) {
  return handleApi(async () => {
    enforceRateLimit(req, "signup", 3, 60_000);
    const input = signupSchema.parse(await readJson(req));

    const existing = await db.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw Object.assign(new Error("An account with this email already exists."), {
        status: 409,
        code: "EMAIL_TAKEN",
      });
    }

    const emailToken = uuidv4();
    const emailTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const user = await db.user.create({
      data: {
        email: input.email,
        name: input.name,
        passwordHash: await hashPassword(input.password),
        locale: input.locale ?? "en",
        emailVerified: false,
        emailToken,
        emailTokenExpiry,
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

    // Send confirmation email
    try {
      await sendConfirmationEmail(user.email, user.name ?? "", emailToken, env.appUrl);
    } catch (emailError) {
      logger.warn("confirmation_email_send_failed", { userId: user.id, error: emailError });
      // Don't fail the signup if email fails - user can retry
    }

    await createSession({
      id: user.id,
      email: user.email,
      name: user.name,
      locale: user.locale,
      theme: user.theme,
    });

    logger.info("user_signed_up", { userId: user.id, email: user.email });
    return { userId: user.id, email: user.email, name: user.name };
  });
}
