import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/prisma";
import Stripe from "stripe";
import { ApiError, enforceRateLimit, handleApi, readJson, requireApiUser } from "@/lib/api/http";
import { env } from "@/lib/env";

const planSchema = z.enum(["starter", "pro"]);

/** Placeholder price ids until billing is enabled (README §3). */
const PRICE_IDS: Record<z.infer<typeof planSchema>, string> = {
  starter: "price_1RyZx2LkJHfd45XyZ8vO6R",
  pro: "price_1RyZyZLkJHfd45XyZ8vO6R",
};

/**
 * Creates a Stripe Checkout session for the *signed-in* user's organization.
 * Never trusts a user id from the client: the session decides who is buying.
 * Billing is a stub in the MVP — without `STRIPE_SECRET_KEY` it answers 503
 * instead of silently creating a session nobody can pay for.
 */
export async function POST(req: NextRequest) {
  return handleApi(async () => {
    enforceRateLimit(req, "stripe:checkout", 5, 60_000);
    const user = await requireApiUser();

    // Accept the plan in the JSON body (normal client) or the query string.
    const body = await readJson(req);
    const fromBody =
      body !== null && typeof body === "object" ? (body as { plan?: unknown }).plan : undefined;
    const fromQuery = new URL(req.url).searchParams.get("plan");
    const plan = planSchema.parse(fromBody ?? fromQuery ?? null);

    const member = await db.orgMember.findFirst({
      where: { userId: user.id },
      include: { organization: true },
    });
    if (!member) {
      throw new ApiError(404, "NOT_FOUND", "No organization found for this account.");
    }
    const organizationId = member.organization.id;

    const secretKey = env.stripeSecretKey;
    if (!secretKey) {
      throw new ApiError(503, "BILLING_NOT_CONFIGURED", "Billing is not configured yet.");
    }
    const stripe = new Stripe(secretKey, { apiVersion: "2022-11-15" });

    const existingSub = await db.subscription.findFirst({ where: { organizationId } });
    const alreadyOnPlan =
      existingSub?.status === "ACTIVE" &&
      ((plan === "starter" && existingSub.plan === "STARTER") ||
        (plan === "pro" && existingSub.plan === "PRO"));
    if (alreadyOnPlan) {
      return { url: `/dashboard?plan=${plan}&already=true` };
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: PRICE_IDS[plan], quantity: 1 }],
      success_url: `${env.appUrl}/dashboard?success=true`,
      cancel_url: `${env.appUrl}/pricing?canceled=true`,
      metadata: { userId: user.id, organizationId, plan },
    });

    return { url: session.url ?? "" };
  });
}
