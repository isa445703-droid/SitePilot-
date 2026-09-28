import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { getOwnedSite } from "@/lib/auth/guards";
import { getServerI18n } from "@/lib/i18n/server";
import { Badge } from "@/components/ui/badge";
import { SiteTabs } from "@/components/sites/site-tabs";
import { AiNotConfiguredNotice } from "@/components/shared/ai-notice";

type Params = { params: Promise<{ siteId: string }> };

export default async function SiteLayout({
  children,
  params,
}: Params & { children: ReactNode }) {
  const user = await requireUser();
  const { siteId } = await params;
  const site = await getOwnedSite(siteId, user.id);
  if (!site) notFound();

  const { t } = await getServerI18n();
  const aiConfigured = Boolean(process.env.MISTRAL_API_KEY);

  return (
    <div>
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">{site.name}</h1>
            <Badge tone={site.status === "LIVE" ? "success" : site.status === "BUILDING" ? "accent" : "neutral"}>
              {t(`sites.status.${site.status}`)}
            </Badge>
            {site.isDemo ? <Badge>{t("common.demoBadge")}</Badge> : null}
            <Badge tone={site.autopilot === "MANUAL" ? "neutral" : "success"}>
              {t(`sites.autopilot.${site.autopilot}`)}
            </Badge>
          </div>
          <p className="mt-1 truncate text-sm text-muted">
            {site.description || site.brief.slice(0, 140)}
          </p>
        </div>
      </header>

      {!aiConfigured ? <AiNotConfiguredNotice className="mb-4" /> : null}

      <SiteTabs siteId={site.id} />
      {children}
    </div>
  );
}
