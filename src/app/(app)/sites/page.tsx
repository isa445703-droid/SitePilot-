import type { Metadata } from "next";
import { Globe, Plus } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db/prisma";
import { accessibleSiteIds } from "@/lib/services/activity";
import { getServerI18n } from "@/lib/i18n/server";
import { PageHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/status";
import { LinkButton } from "@/components/ui/button";
import { SiteCard } from "@/components/sites/site-card";

export const metadata: Metadata = { title: "Sites" };

export default async function SitesPage() {
  const user = await requireUser();
  const { t, locale } = await getServerI18n();

  const siteIds = await accessibleSiteIds(user.id);
  const sites = siteIds.length
    ? await db.site.findMany({
        where: { id: { in: siteIds }, status: { not: "ARCHIVED" } },
        orderBy: { updatedAt: "desc" },
        include: {
          _count: { select: { articles: true, pages: true } },
          schedule: { select: { enabled: true, nextRunAt: true, frequency: true } },
        },
      })
    : [];

  return (
    <>
      <PageHeader
        title={t("sites.title")}
        description={t("sites.subtitle")}
        actions={
          <LinkButton href="/sites/new" variant="primary" icon={<Plus className="h-4 w-4" />}>
            {t("sites.create")}
          </LinkButton>
        }
      />

      {sites.length === 0 ? (
        <EmptyState
          title={t("sites.emptyTitle")}
          body={t("sites.emptyBody")}
          icon={<Globe className="h-5 w-5" />}
          action={
            <LinkButton href="/sites/new" variant="primary">
              {t("sites.create")}
            </LinkButton>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {sites.map((site) => (
            <SiteCard key={site.id} site={site} locale={locale} />
          ))}
        </div>
      )}
    </>
  );
}
