"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, errorMessage } from "@/lib/api/client";
import { useT } from "@/lib/i18n/provider";

type State = "checking" | "confirmed" | "invalid";

/** Confirms the emailed token on mount and reports the outcome. */
export function ConfirmEmailCard({ token }: { token: string | null }) {
  const t = useT();
  const [state, setState] = useState<State>("checking");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setState("invalid");
      return;
    }

    let cancelled = false;
    api
      .get<unknown>(`/api/auth/confirm/email?token=${encodeURIComponent(token)}`)
      .then(() => {
        if (!cancelled) setState("confirmed");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setMessage(errorMessage(error, (key) => t(key)));
        setState("invalid");
      });

    return () => {
      cancelled = true;
    };
  }, [token, t]);

  return (
    <div className="min-h-dvh bg-surface/90 p-8 sm:p-12">
      <div className="mx-auto max-w-md">
        <div className="rounded-2xl border border-line/50 bg-white p-8 sm:p-10">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-accent/10 text-accent">
              <span className="text-4xl">✓</span>
            </div>
            <h1 className="text-2xl font-bold text-ink">{t("auth.confirmEmail.cta")}</h1>
          </div>

          {state === "checking" ? (
            <div className="flex items-center justify-center py-6" role="status">
              <span className="spinner" aria-hidden="true" />
              <span className="sr-only">{t("auth.confirmEmail.cta")}</span>
            </div>
          ) : null}

          {state === "confirmed" ? (
            <div className="mb-6 rounded-xl bg-success-soft p-4 text-success" role="status">
              {t("auth.confirmEmail.success")}
            </div>
          ) : null}

          {state === "invalid" ? (
            <div className="mb-6 rounded-xl bg-danger-soft p-4 text-danger" role="alert">
              {message ?? t("auth.confirmEmail.error.invalid")}
            </div>
          ) : null}

          <div className="text-center text-sm text-muted">
            <Link href="/login" className="text-primary hover:underline">
              {t("auth.signedIn")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
