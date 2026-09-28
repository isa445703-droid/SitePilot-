"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileCode2, ScanSearch, Wrench } from "lucide-react";
import { useT } from "@/lib/i18n/provider";
import { api, errorMessage } from "@/lib/api/client";
import { Button, LinkButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/status";
import { useToast } from "@/components/ui/toast";

export type SeoIssueRow = {
  id: string;
  type: string;
  severity: string;
  message: string;
  article?: { id: string; title: string } | null;
};

export function SeoPanel({
  siteId,
  initialIssues,
  siteTitle,
  metaDescription,
  indexable,
  robotsPath,
  sitemapPath,
}: {
  siteId: string;
  initialIssues: SeoIssueRow[];
  siteTitle: string;
  metaDescription: string;
  indexable: boolean;
  robotsPath: string;
  sitemapPath: string;
}) {
  const t = useT();
  const router = useRouter();
  const toast = useToast();

  const [issues, setIssues] = useState(initialIssues);
  const [busy, setBusy] = useState<null | "audit" | "fix">(null);
  const [error, setError] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<string | null>(null);

  // Re-sync when the server component refreshes with new rows.
  useEffect(() => {
    setIssues(initialIssues);
  }, [initialIssues]);

  const run = async (fix: boolean) => {
    setBusy(fix ? "fix" : "audit");
    setError(null);
    try {
      const result = await api.post<{ issues: number; fixed: number }>(
        `/api/sites/${siteId}/seo`,
        { fix },
      );
      if (fix) setIssues([]);
      setLastRun(new Date().toISOString());
      toast.success(
        fix ? `${t("seo.fixed")}: ${result.fixed}` : `${t("seo.issues")}: ${result.issues}`,
      );
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught, t));
    } finally {
      setBusy(null);
    }
  };

  const severityTone = (severity: string) =>
    severity === "error" ? "danger" : severity === "warning" ? "warning" : "neutral";

  return (
    <div className="space-y-4">
      {error ? (
        <Alert tone="danger" role="alert">
          {error}
        </Alert>
      ) : null}

      <Card>
        <CardHeader
          title={t("seo.basics")}
          description={t("seo.subtitle")}
          actions={
            <>
              <Button
                size="sm"
                loading={busy === "audit"}
                onClick={() => run(false)}
                icon={<ScanSearch className="h-4 w-4" />}
              >
                {busy === "audit" ? t("seo.auditing") : t("seo.runAudit")}
              </Button>
              <Button
                size="sm"
                variant="primary"
                loading={busy === "fix"}
                onClick={() => run(true)}
                icon={<Wrench className="h-4 w-4" />}
              >
                {t("seo.fixAll")}
              </Button>
            </>
          }
        />
        <CardBody className="space-y-3">
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="surface-2 p-3">
              <dt className="text-xs font-medium uppercase tracking-wide text-faint">
                {t("editor.seoTitle")}
              </dt>
              <dd className="mt-1 break-words text-sm">{siteTitle || "—"}</dd>
            </div>
            <div className="surface-2 p-3">
              <dt className="text-xs font-medium uppercase tracking-wide text-faint">
                {t("seo.metaDescription")}
              </dt>
              <dd className="mt-1 break-words text-sm">{metaDescription || "—"}</dd>
            </div>
          </dl>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge tone={indexable ? "success" : "warning"}>
              {indexable ? t("common.enabled") : t("common.disabled")}
            </Badge>
            <LinkButton href={robotsPath} size="sm" variant="ghost" icon={<FileCode2 className="h-4 w-4" />}>
              {t("seo.robots")}
            </LinkButton>
            <LinkButton href={sitemapPath} size="sm" variant="ghost" icon={<FileCode2 className="h-4 w-4" />}>
              {t("seo.sitemap")}
            </LinkButton>
          </div>

          {lastRun ? (
            <p className="text-xs text-faint">
              {t("seo.lastAudit")}: {new Date(lastRun).toLocaleString()}
            </p>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={`${t("seo.issues")} (${issues.length})`}
          actions={
            issues.length > 0 ? <Badge tone="warning">{t("seo.issues")}</Badge> : <Badge tone="success">{t("common.none")}</Badge>
          }
        />
        <CardBody>
          {issues.length === 0 ? (
            <EmptyState
              title={t("seo.noIssuesTitle")}
              body={t("seo.noIssuesBody")}
              icon={<CheckCircle2 className="h-5 w-5" />}
            />
          ) : (
            <ul className="space-y-2.5">
              {issues.map((issue) => (
                <li key={issue.id} className="surface-2 flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
                  <Badge tone={severityTone(issue.severity) as "danger" | "warning" | "neutral"}>
                    {t(`seo.severity.${issue.severity}`)}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {t(`seo.types.${issue.type}`) === `seo.types.${issue.type}`
                        ? issue.type
                        : t(`seo.types.${issue.type}`)}
                    </p>
                    <p className="break-words text-xs text-muted">{issue.message}</p>
                  </div>
                  {issue.article ? (
                    <span className="shrink-0 text-xs text-muted">{issue.article.title}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
