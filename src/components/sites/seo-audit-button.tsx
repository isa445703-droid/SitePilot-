"use client";

import { useState } from "react";
import { ScanSearch } from "lucide-react";
import { useT } from "@/lib/i18n/provider";
import { api, errorMessage } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

/** Runs the deterministic SEO audit for one site. */
export function SeoAuditButton({
  siteId,
  size = "sm",
}: {
  siteId: string;
  size?: "sm" | "md";
}) {
  const t = useT();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const result = await api.post<{ issues: number; fixed: number }>(
        `/api/sites/${siteId}/seo`,
        { fix: false },
      );
      toast.success(`${t("seo.issues")}: ${result.issues}`);
    } catch (error) {
      toast.error(errorMessage(error, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      size={size}
      variant="secondary"
      loading={busy}
      onClick={run}
      icon={<ScanSearch className="h-4 w-4" />}
    >
      {busy ? t("seo.auditing") : t("seo.runAudit")}
    </Button>
  );
}
