import { NextRequest } from "next/server";
import Stripe from "stripe";
import { handleApi } from "@/lib/api/http";
import { logger } from "@/lib/logger";
import { db } from "@/lib/db/prisma";
import { env } from "@/lib/env";

const stripe = new Stripe(env.stripeSecretKey || "", {
  apiVersion: "2022-11-15",
});

export const config = {
  api: {
    bodyParser: false,
  },
};

export async function POST(req: NextRequest) {
  return handleApi(async () => {
    const sig = req.headers.get("stripe-signature") || "";
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        await req.text(),
        sig,
        env.stripeWebhookSecret || "",
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      logger.error("stripe_webhook_signature_failed", { error: message });
      throw new Error("Webhook signature verification failed.", { cause: { status: 400 } });
    }

    // Handle checkout.session.completed - create/update subscription
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      const plan = session.metadata?.plan as "FREE" | "STARTER" | "PRO";

      if (!userId) {
        logger.warn("stripe_webhook_no_user_id", { sessionId: session.id });
        return { ok: true };
      }

      // Find the organization/user
      const user = await db.user.findUnique({ where: { id: userId } });
      if (!user) {
        logger.warn("stripe_webhook_user_not_found", { userId });
        return { ok: true };
      }

      const member = await db.orgMember.findFirst({
        where: { userId: user.id },
        include: { organization: true },
      });
      if (!member) {
        logger.warn("stripe_webhook_no_org", { userId });
        return { ok: true };
      }
      const organizationId = member.organization.id;

      // Find or create subscription
      let subscription = await db.subscription.findUnique({
        where: { organizationId },
      });

      if (!subscription) {
        subscription = await db.subscription.create({
          data: {
            organizationId,
            plan,
            status: "ACTIVE",
          },
        });
      } else {
        await db.subscription.update({
          where: { id: subscription.id },
          data: { plan, status: "ACTIVE" },
        });
      }

      logger.info("stripe_webhook_subscription_created", {
        userId,
        plan,
        subscriptionId: subscription.id,
      });
    }

    // Handle customer.subscription.deleted - cancel subscription
    else if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;

      // Find the subscription and its organization
      const dbSub = await db.subscription.findFirst({
        where: {
          stripeCustomerId: subscription.customer as string,
        },
        include: { organization: true },
      });

      if (dbSub?.organization) {
        await db.subscription.update({
          where: { id: dbSub.id },
          data: { status: "CANCELED" },
        });
        logger.info("stripe_webhook_subscription_canceled", { orgId: dbSub.organization.id });
      }
    }

    return { ok: true };
  });
}