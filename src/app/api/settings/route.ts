import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/prisma";
import { handleApi, readJson, requireApiUser, enforceRateLimit } from "@/lib/api/http";

/** GET /api/settings — the caller's profile, workspace and AI provider status. */
export async function GET() {
  return handleApi(async () => {
    const user = await requireApiUser();
    const membership = await db.orgMember.findFirst({
      where: { userId: user.id },
      include: { organization: true },
      orderBy: { createdAt: "asc" },
    });

    return {
      user: { id: user.id, name: user.name, email: user.email, locale: user.locale, theme: user.theme },
      organization: membership
        ? { id: membership.organization.id, name: membership.organization.name, role: membership.role }
        : null,
      ai: {
        configured: Boolean(process.env.MISTRAL_API_KEY),
        model: process.env.MISTRAL_MODEL ?? "",
      },
      billing: { provider: "stripe", enabled: Boolean(process.env.STRIPE_SECRET_KEY) },
    };
  });
}

const patchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  locale: z.enum(["en", "ru", "ko"]).optional(),
  theme: z.enum(["light", "dark", "system"]).optional(),
});

/** PATCH /api/settings — update the caller's own profile (never another user). */
export async function PATCH(req: NextRequest) {
  return handleApi(async () => {
    const user = await requireApiUser();
    enforceRateLimit(req, `settings:${user.id}`, 30, 60_000);
    const input = patchSchema.parse(await readJson(req));

    const updated = await db.user.update({
      where: { id: user.id },
      data: input,
      select: { id: true, name: true, email: true, locale: true, theme: true },
    });

    return updated;
  });
}
