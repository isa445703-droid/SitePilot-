import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/prisma";
import { handleApi } from "@/lib/api/http";

const confirmEmailSchema = z.object({
  token: z.string().trim().min(1),
});

/**
 * GET /api/auth/confirm/email?token=...
 *
 * Confirms the address the token belongs to. Idempotent: the token is kept
 * (it expires on its own after 24h) and it only ever flips `emailVerified`,
 * so a user who clicks the link twice — or reloads the page — sees a success
 * screen both times instead of an alarming error.
 */
export async function GET(req: NextRequest) {
  return handleApi(async () => {
    const token = new URL(req.url).searchParams.get("token");

    if (!token) {
      throw Object.assign(new Error("Confirmation token is required."), {
        status: 400,
        code: "MISSING_TOKEN",
      });
    }

    const input = confirmEmailSchema.parse({ token });
    const user = await db.user.findFirst({ where: { emailToken: input.token } });

    if (!user) {
      throw Object.assign(new Error("Invalid or expired confirmation token."), {
        status: 400,
        code: "INVALID_TOKEN",
      });
    }

    if (user.emailVerified) {
      return { alreadyVerified: true };
    }

    if (user.emailTokenExpiry && user.emailTokenExpiry < new Date()) {
      throw Object.assign(new Error("Confirmation token has expired."), {
        status: 400,
        code: "TOKEN_EXPIRED",
      });
    }

    await db.user.update({
      where: { id: user.id },
      data: { emailVerified: true },
    });

    return { confirmed: true };
  });
}
