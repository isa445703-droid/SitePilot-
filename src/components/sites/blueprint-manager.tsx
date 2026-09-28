"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, RefreshCw, Save, Sparkles, Wand2 } from "lucide-react";
import { useT } from "@/lib/i18n/provider";
import { api, errorMessage } from "@/lib/api/client";
import type { Blueprint } from "@/lib/ai/schemas";
import { Button, LinkButton } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";
import { BlueprintEditor } from "@/components/sites/blueprint-editor";

export function BlueprintManager({
  siteId,
  initial,
  generated,
  aiConfigured,
}: {
  siteId: string;
  initial: Blueprint | null;
  generated: boolean;
  aiConfigured: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const toast = useToast();
  const [blueprint, setBlueprint] = useState<Blueprint | null>(initial);
  const [busy, setBusy] = useState<null | "generate" | "save" | "approve">(null);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setBusy("generate");
    setError(null);
    try {
      const result = await api.post<{ blueprint: Blueprint; isDemo: boolean }>(
        `/api/sites/${siteId}/blueprint`,
        {},
      );
      setBlueprint(result.blueprint);
      toast.success(t("common.saved"));
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught, t));
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    if (!blueprint) return;
    setBusy("save");
    setError(null);
    try {
      await api.put(`/api/sites/${siteId}/blueprint`, { blueprint });
      toast.success(t("common.saved"));
    } catch (caught) {
      setError(errorMessage(caught, t));
    } finally {
      setBusy(null);
    }
  };

  const approve = async () => {
    if (!blueprint) return;
    setBusy("approve");
    setError(null);
    try {
      await api.put(`/api/sites/${siteId}/blueprint`, { blueprint });
      await api.post(`/api/sites/${siteId}/generate`, {});
      toast.success(t("onboarding.siteReady"));
      router.push(`/sites/${siteId}/schedule`);
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught, t));
    } finally {
      setBusy(null);
    }
  };

  if (!blueprint) {
    return (
      <div className="card-flat grid place-items-center gap-3 p-10 text-center">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-accent-soft text-accent">
          <Wand2 className="h-5 w-5" aria-hidden="true" />
        </span>
        <h2 className="text-base font-semibold">{t("site.overview.noBlueprint")}</h2>
        {!aiConfigured ? (
          <p className="max-w-md text-sm text-muted">{t("sites.aiNotConfiguredHelp")}</p>
        ) : null}
        {error ? (
          <Alert tone="danger" role="alert">
            {error}
          </Alert>
        ) : null}
        <Button
          variant="primary"
          loading={busy === "generate"}
          onClick={generate}
          icon={<Sparkles className="h-4 w-4" />}
        >
          {t("site.overview.noBlueprintCta")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error ? (
        <Alert
          tone="danger"
          role="alert"
          actions={
            <Button size="sm" onClick={() => setError(null)}>
              {t("common.close")}
            </Button>
          }
        >
          {error}
        </Alert>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button
          size="sm"
          onClick={generate}
          loading={busy === "generate"}
          icon={<RefreshCw className="h-4 w-4" />}
        >
          {t("onboarding.regenerate")}
        </Button>
        <Button
          size="sm"
          onClick={save}
          loading={busy === "save"}
          icon={<Save className="h-4 w-4" />}
        >
          {busy === "save" ? t("common.saving") : t("common.save")}
        </Button>
        <LinkButton href={`/sites/${siteId}`} size="sm" variant="ghost">
          {t("common.cancel")}
        </LinkButton>
        {!generated ? (
          <Button
            size="sm"
            variant="primary"
            loading={busy === "approve"}
            onClick={approve}
            icon={<Check className="h-4 w-4" />}
          >
            {t("onboarding.approve")}
          </Button>
        ) : null}
      </div>

      <BlueprintEditor value={blueprint} onChange={setBlueprint} disabled={busy !== null} />
    </div>
  );
}
