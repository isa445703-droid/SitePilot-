"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { useT } from "@/lib/i18n/provider";
import { Button } from "@/components/ui/button";

/** Route error boundary: never renders a stack trace to the user. */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useT();

  useEffect(() => {
    // Structured, secret-free client log for support/diagnostics.
    console.error("sitepilot_client_error", { digest: error.digest ?? null });
  }, [error.digest]);

  return (
    <div className="grid min-h-dvh place-items-center p-6">
      <div className="card w-full max-w-md p-6 text-center">
        <h1 className="text-lg font-bold">{t("errors.boundaryTitle")}</h1>
        <p className="mt-2 text-sm text-muted">{t("errors.boundaryBody")}</p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button variant="primary" onClick={reset} icon={<RefreshCw className="h-4 w-4" />}>
            {t("common.retry")}
          </Button>
          <Link href="/" className="btn btn-secondary">
            {t("common.goHome")}
          </Link>
        </div>
        {error.digest ? (
          <p className="mt-4 text-xs text-faint">
            {t("common.unknown")} · {error.digest}
          </p>
        ) : null}
      </div>
    </div>
  );
}
