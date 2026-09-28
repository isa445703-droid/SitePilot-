import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, getOwnedSite } from "@/lib/auth/guards";
import { db } from "@/lib/db/prisma";
import { loadSitePreview } from "@/lib/preview/data";
import { getServerI18n } from "@/lib/i18n/server";
import { SiteChrome } from "@/components/preview/site-chrome";
import { Breadcrumbs } from "@/components/preview/site-parts";
import { Blocks } from "@/components/preview/public-views";
import { decodeRouteParam } from "@/lib/utils/params";

export const metadata: Metadata = { title: "Preview" };

type Params = { params: Promise<{ siteId: string; slug: string }> };

export default async function PreviewPagePage({ params }: Params) {
  const user = await requireUser();
  const { siteId, slug: raw } = await params;
  const slug = decodeRouteParam(raw);
  const owned = await getOwnedSite(siteId, user.id);
  if (!owned) notFound();

  const data = await loadSitePreview(siteId);
  if (!data) notFound();

  const { site, design, settings, categories } = data;
  const page = await db.page.findFirst({ where: { siteId: site.id, slug } });
  if (!page) notFound();

  const { t, locale } = await getServerI18n();
  const basePath = `/preview/${site.id}`;

  return (
    <SiteChrome
      siteName={settings?.siteTitle || site.name}
      siteSlug={site.slug}
      basePath={basePath}
      design={design}
      categories={categories}
      footerText={settings?.footerText || undefined}
      locale={locale}
      homeLabel={t("preview.home")}
      previewBar={
        <div className="border-b border-line bg-accent-soft px-3 py-1.5 text-center text-xs text-accent">
          {t("preview.previewNotice")}
        </div>
      }
    >
      <article className="pv-article pv-page">
        <Breadcrumbs basePath={basePath} homeLabel={t("preview.home")} />
        <header className="pv-article-head">
          <h1>{page.title}</h1>
        </header>
        <div className="pv-prose-body">
          <Blocks content={page.content} />
        </div>
        <footer className="pv-article-foot">
          <Link href={basePath} className="pv-btn pv-btn-ghost">
            ← {t("common.goHome")}
          </Link>
        </footer>
      </article>
    </SiteChrome>
  );
}
