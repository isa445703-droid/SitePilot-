import { Resend } from "resend";
import React from "react";
import { VerificationEmail } from "@/components/email/verification";
import { getServerI18nFor } from "@/lib/i18n/server";

const CONFIRMATION_LINK_TTL_HOURS = 24;

let resend: Resend | null = null;

/**
 * Resend throws when it is constructed without an API key, and this module is
 * evaluated while Next.js collects route data during `next build` — so the
 * client is created on first use, not at import time. A missing key then
 * surfaces as a caught, logged send failure instead of a failed build.
 */
function getResend(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured.");
  }
  if (!resend) resend = new Resend(apiKey);
  return resend;
}

export async function sendConfirmationEmail(
  email: string,
  name: string,
  token: string,
  appUrl: string
) {
  const { t } = getServerI18nFor("en");
  // Lands on the confirmation page, which calls GET /api/auth/confirm/email.
  const confirmationUrl = `${appUrl}/auth/confirm/email?token=${encodeURIComponent(token)}`;

  const { data, error } = await getResend().emails.send({
    from: "onboarding@sitepilot.dev",
    to: email,
    subject: t("auth.confirmEmail.subject"),
    react: (
      <VerificationEmail
        title={t("auth.confirmEmail.title", { name })}
        description={t("auth.confirmEmail.description")}
        cta={t("auth.confirmEmail.cta")}
        expires={t("auth.confirmEmail.expires", { hours: CONFIRMATION_LINK_TTL_HOURS })}
        url={confirmationUrl}
      />
    ),
  });

  if (error) {
    throw new Error(`Failed to send email: ${error.message}`);
  }

  return data;
}
