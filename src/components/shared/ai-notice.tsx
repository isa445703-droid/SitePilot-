"use client";

import { AlertTriangle } from "lucide-react";
import { useT } from "@/lib/i18n/provider";
import { Alert } from "@/components/ui/alert";

/** Shown whenever MISTRAL_API_KEY is missing (demo mode instead of live AI). */
export function AiNotConfiguredNotice({ className = "" }: { className?: string }) {
  const t = useT();
  return (
    <Alert tone="warning" title={t("sites.aiNotConfigured")} className={className}>
      {t("sites.aiNotConfiguredHelp")}
      <span className="sr-only">
        <AlertTriangle aria-hidden="true" />
      </span>
    </Alert>
  );
}
