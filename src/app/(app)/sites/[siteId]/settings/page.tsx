import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser, getOwnedSite } from "@/lib/auth/guards";
import { db } from "@/lib/db/prisma";
import { getServerI18n } from "@/lib/i18n/server";
import { PageHeader } from "@/components/ui/card";
import { SiteSettingsForm } from "@/components/settings/site-settings-form";

export const metadata: Metadata = { title: "Site settings" };

type Params = { params: Promise<{ siteId: string }> };

export default async function SiteSettingsPage({ params }: Params) {
  const user = await requireUser();
  const { siteId } = await params;
  const site = await getOwnedSite(siteId, user.id);
  if (!site) notFound();

  const { t } = await getServerI18n();
  const [brand, design, settings] = await Promise.all([
    db.siteBrand.findUnique({ where: { siteId } }),
    db.siteDesign.findUnique({ where: { siteId } }),
    db.siteSettings.findUnique({ where: { siteId } }),
  ]);

  return (
    <>
      <PageHeader title={t("siteSettings.title")} description={site.name} />
      <SiteSettingsForm
        siteId={site.id}
        initial={{
          site: {
            name: site.name,
            description: site.description,
            language: site.language,
            timezone: site.timezone,
            publishHour: site.publishHour,
            frequency: site.frequency,
          },
          brand: {
            brandVoice: brand?.brandVoice ?? "",
            keywords: (brand?.keywords ?? []) as string[],
          },
          design: design
            ? {
                primaryColor: design.primaryColor,
                secondaryColor: design.secondaryColor,
                surfaceColor: design.surfaceColor,
                backgroundColor: design.backgroundColor,
                textColor: design.textColor,
                mutedColor: design.mutedColor,
                fontStyle: design.fontStyle,
                layoutStyle: design.layoutStyle,
                cardStyle: design.cardStyle,
                headerStyle: design.headerStyle,
                heroStyle: design.heroStyle,
                cardDensity: design.cardDensity,
                borderRadius: design.borderRadius,
              }
            : null,
          settings: {
            siteTitle: settings?.siteTitle ?? "",
            metaDescription: settings?.metaDescription ?? "",
            indexable: settings?.indexable ?? true,
          },
        }}
      />
    </>
  );
}
