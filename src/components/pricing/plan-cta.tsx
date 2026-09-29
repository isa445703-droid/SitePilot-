"use client";

import { useState, type ReactNode } from "react";
import { Button, type ButtonVariant } from "@/components/ui/button";
import { api, errorMessage } from "@/lib/api/client";
import { useT } from "@/lib/i18n/provider";

/**
 * Paid-plan CTA. A checkout is a state-changing request, so it POSTs instead of
 * linking at the API (a GET link would both 405 and be CSRF-able), then hands
 * the browser over to Stripe's hosted page.
 */
export function PlanCta({
  plan,
  variant = "secondary",
  children,
}: {
  plan: "starter" | "pro";
  variant?: ButtonVariant;
  children: ReactNode;
}) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startCheckout = async () => {
    setBusy(true);
    setError(null);
    try {
      const { url } = await api.post<{ url: string }>("/api/stripe/checkout", { plan });
      window.location.assign(url || "/dashboard");
    } catch (err) {
      setError(errorMessage(err, (key) => t(key)));
      setBusy(false);
    }
  };

  return (
    <div className="mt-4">
      <Button type="button" variant={variant} size="lg" block loading={busy} onClick={startCheckout}>
        {children}
      </Button>
      {error ? (
        <p className="mt-2 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
