"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useT } from "@/lib/i18n/provider";
import { api, errorMessage } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";

/** Signs out via the API, then navigates to the login screen. */
export function SignOutButton({ block = false }: { block?: boolean }) {
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <Button
      variant="danger"
      block={block}
      loading={busy}
      icon={<LogOut className="h-4 w-4" />}
      onClick={async () => {
        setBusy(true);
        try {
          await api.post("/api/auth/logout");
        } finally {
          router.push("/login");
          router.refresh();
        }
      }}
    >
      {busy ? t("common.loading") : t("common.signOut")}
    </Button>
  );
}

export function AccountSettings({
  user,
  organization,
}: {
  user: { id: string; name: string | null; email: string };
  organization: { name: string; role: string } | null;
}) {
  const t = useT();
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState(user.name ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.patch("/api/settings", { name });
      toast.success(t("settings.saved"));
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="mb-4">
      <CardHeader title={t("settings.account")} />
      <CardBody className="space-y-4">
        {error ? (
          <Alert tone="danger" role="alert">
            {error}
          </Alert>
        ) : null}

        <Field label={t("auth.name")}>
          {({ id }) => (
            <Input id={id} value={name} onChange={(event) => setName(event.target.value)} />
          )}
        </Field>

        <Field label={t("auth.email")}>
          {({ id }) => <Input id={id} value={user.email} readOnly />}
        </Field>

        {organization ? (
          <div className="surface-2 p-3 text-sm">
            <p className="font-medium">{t("settings.organization")}</p>
            <p className="mt-0.5 text-muted">
              {organization.name} · {organization.role}
            </p>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="surface-2 p-3 text-sm">
            <p className="font-medium">{t("settings.plan")}</p>
            <p className="mt-0.5 text-muted">{t("settings.billingSoon")}</p>
          </div>
          <div className="surface-2 p-3 text-sm">
            <p className="font-medium">{t("settings.billing")}</p>
            <p className="mt-0.5 text-muted">{t("settings.billingSoon")}</p>
          </div>
        </div>

        <Button variant="primary" loading={busy} onClick={save}>
          {busy ? t("common.saving") : t("common.save")}
        </Button>

        <p className="text-xs text-muted">
          <span className="sr-only">{t("settings.uiLanguage")}</span>
          {t("footer.product")}
        </p>
      </CardBody>
    </Card>
  );
}

export function AiProviderCard({ configured, model }: { configured: boolean; model: string }) {
  const t = useT();
  return (
    <Card>
      <CardHeader title={t("settings.aiProvider")} />
      <CardBody className="space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <span
            className={`h-2.5 w-2.5 rounded-full ${configured ? "bg-success" : "bg-warning"}`}
            aria-hidden="true"
          />
          <span>{configured ? t("settings.aiConfigured") : t("settings.aiMissing")}</span>
        </div>
        <p className="text-muted">
          {t("settings.aiModel")}: <span className="font-medium text-ink">{model || "—"}</span>
        </p>
        {!configured ? <p className="text-muted">{t("settings.aiMissingHelp")}</p> : null}
      </CardBody>
    </Card>
  );
}
