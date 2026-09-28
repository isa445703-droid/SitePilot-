import type { ReactNode } from "react";
import Link from "next/link";
import { formatDate, type Locale } from "@/lib/i18n/config";

export type DesignTokens = {
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  fontStyle: string;
  layoutStyle: string;
  cardStyle: string;
  borderRadius: number;
};

export const DEFAULT_DESIGN: DesignTokens = {
  primaryColor: "#2563eb",
  secondaryColor: "#0f172a",
  backgroundColor: "#ffffff",
  textColor: "#0f172a",
  fontStyle: "modern",
  layoutStyle: "centered",
  cardStyle: "soft",
  borderRadius: 12,
};

const CONTAINER_CLASS: Record<string, string> = {
  centered: "max-w-3xl",
  wide: "max-w-6xl",
  magazine: "max-w-7xl",
};

/**
 * Renders a generated site the way visitors see it. Design tokens come from
 * the approved blueprint; content is data, rendered through safe components.
 */
export function SiteChrome({
  siteName,
  siteSlug,
  basePath,
  design,
  categories,
  footerText,
  children,
  previewBar,
  locale,
  homeLabel,
}: {
  siteName: string;
  siteSlug: string;
  basePath: string;
  design: DesignTokens;
  categories: Array<{ id: string; name: string; slug: string }>;
  footerText?: string;
  children: ReactNode;
  previewBar?: ReactNode;
  locale: Locale;
  homeLabel?: string;
}) {
  const container = CONTAINER_CLASS[design.layoutStyle] ?? CONTAINER_CLASS.centered;

  return (
    <div
      className="preview-root min-h-dvh"
      style={
        {
          "--pv-primary": design.primaryColor,
          "--pv-secondary": design.secondaryColor,
          "--pv-bg": design.backgroundColor,
          "--pv-text": design.textColor,
          "--pv-radius": `${design.borderRadius}px`,
          background: design.backgroundColor,
          color: design.textColor,
        } as React.CSSProperties
      }
      data-fonts={`fonts-${design.fontStyle}`}
      data-cards={design.cardStyle}
    >
      {previewBar}

      <header className="pv-header">
        <div className={`pv-container flex items-center justify-between gap-4 py-4 ${container}`}>
          <Link
            href={basePath}
            className="text-lg font-extrabold tracking-tight"
            style={{ color: design.primaryColor }}
          >
            {siteName}
          </Link>
          <nav aria-label={siteName} className="pv-nav">
            <Link href={basePath}>{homeLabel ?? siteSlug}</Link>
            {categories.slice(0, 5).map((category) => (
              <Link key={category.id} href={`${basePath}/c/${category.slug}`}>
                {category.name}
              </Link>
            ))}
          </nav>
          <Link
            href={`${basePath}/sitemap.xml`}
            className="text-xs underline sm:hidden"
            style={{ color: design.primaryColor }}
          >
            sitemap
          </Link>
        </div>
      </header>

      <main className={`pv-container py-6 sm:py-10 ${container}`}>
        <div className={design.fontStyle === "editorial" ? "pv-article" : "pv-body"}>{children}</div>
      </main>

      <footer
        style={{ borderTop: `1px solid color-mix(in oklab, ${design.textColor} 12%, transparent)` }}
      >
        <div className={`pv-container flex flex-col gap-1 py-6 text-sm sm:flex-row sm:items-center sm:justify-between ${container}`}>
          <p style={{ color: `color-mix(in oklab, ${design.textColor} 70%, transparent)` }}>
            © {new Date().getFullYear()} {siteName}
          </p>
          <p style={{ color: `color-mix(in oklab, ${design.textColor} 70%, transparent)` }}>
            {footerText ?? formatDate(new Date(), locale)}
          </p>
        </div>
      </footer>
    </div>
  );
}
