import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, getOwnedSite } from "@/lib/auth/guards";
import { db } from "@/lib/db/prisma";
import { loadSitePreview } from "@/lib/preview/data";
import { getServerI18n } from "@/lib/i18n/server";
import { SiteChrome } from "@/components/preview/site-chrome";
import { Markdown } from "@/components/preview/markdown";

export const metadata: Metadata = { title: "Preview" };

type Params = { params: Promise<{ siteId: string; slug: string }> };

export default async function PreviewPagePage({ params }: Params) {
  const user = await requireUser();
  const { siteId, slug } = await params;
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
      <article>
        <h1>{page.title}</h1>
        <Blocks content={page.content} />
      </article>
      <nav aria-label={t("common.goHome")} style={{ marginTop: "2.5rem" }}>
        <Link href={basePath}>← {t("common.goHome")}</Link>
      </nav>
    </SiteChrome>
  );
}

/** Page blocks stored as JSON (plain data, never executable). */
function Blocks({ content }: { content: unknown }) {
  const blocks = Array.isArray(content) ? (content as Array<Record<string, unknown>>) : [];
  return (
    <>
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          const text = String(block.text ?? "");
          const level = Number(block.level ?? 2);
          return level <= 1 ? <h2 key={index}>{text}</h2> : <h3 key={index}>{text}</h3>;
        }
        if (block.type === "list") {
          const items = Array.isArray(block.items) ? (block.items as string[]) : [];
          return (
            <ul key={index}>
              {items.map((item, itemIndex) => (
                <li key={itemIndex}>{item}</li>
              ))}
            </ul>
          );
        }
        if (block.type === "quote") {
          return <blockquote key={index}>{String(block.text ?? "")}</blockquote>;
        }
        return <Markdown key={index} content={String(block.text ?? "")} />;
      })}
    </>
  );
}
