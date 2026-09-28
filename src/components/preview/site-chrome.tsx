import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { formatDate, type Locale } from "@/lib/i18n/config";
import { buttonAccent, ensureContrast, isDark, mix } from "@/lib/preview/color";

export type DesignTokens = {
  primaryColor: string;
  secondaryColor: string;
  surfaceColor: string;
  backgroundColor: string;
  textColor: string;
  mutedColor: string;
  fontStyle: string;
  layoutStyle: string;
  cardStyle: string;
  borderRadius: number;
  headerStyle: string;
  heroStyle: string;
  cardDensity: string;
};

/** Design used when a site has no stored palette (also the API fallback). */
export const DEFAULT_DESIGN: DesignTokens = {
  primaryColor: "#2563eb",
  secondaryColor: "#0f172a",
  surfaceColor: "#ffffff",
  backgroundColor: "#f7f8fa",
  textColor: "#0f172a",
  mutedColor: "#475569",
  fontStyle: "modern",
  layoutStyle: "centered",
  cardStyle: "soft",
  borderRadius: 12,
  headerStyle: "plain",
  heroStyle: "banded",
  cardDensity: "comfortable",
};

const CONTAINER_CLASS: Record<string, string> = {
  centered: "max-w-3xl",
  wide: "max-w-6xl",
  magazine: "max-w-7xl",
};

const FONT_STACKS: Record<string, string> = {
  modern:
    'var(--pv-font-sans), "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans KR", "Malgun Gothic", sans-serif',
  classic: '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, "Times New Roman", serif',
  editorial: '"Spectral", "Source Serif 4", Georgia, Cambria, "Times New Roman", serif',
};

/**
 * Derives the CSS custom properties a generated site renders with.
 *
 * The AI (or a human in the blueprint editor) picks the base colours; hover
 * tints, borders, shadows, muted text and button colours are computed here so
 * every component can rely on the same readable set of roles.
 */
function themeStyle(design: DesignTokens): CSSProperties {
  const surface = design.surfaceColor || DEFAULT_DESIGN.surfaceColor;
  const background = design.backgroundColor || DEFAULT_DESIGN.backgroundColor;
  const dark = isDark(surface);
  const text = ensureContrast(design.textColor || DEFAULT_DESIGN.textColor, surface, 4.5);
  const muted = ensureContrast(design.mutedColor || DEFAULT_DESIGN.mutedColor, surface, 4.5);
  const accent = ensureContrast(design.primaryColor || DEFAULT_DESIGN.primaryColor, surface, 3.5);
  const button = buttonAccent(design.primaryColor || DEFAULT_DESIGN.primaryColor, surface);

  const border = mix(surface, dark ? "#ffffff" : "#0f172a", dark ? 0.16 : 0.12);
  const borderStrong = mix(surface, dark ? "#ffffff" : "#0f172a", dark ? 0.3 : 0.22);
  const shadowColor = dark ? "rgb(0 0 0 / 0.55)" : "rgb(15 23 42 / 0.14)";
  const radius = Math.min(32, Math.max(0, Number(design.borderRadius) || 0));

  return {
    "--pv-primary": accent,
    "--pv-primary-raw": design.primaryColor || DEFAULT_DESIGN.primaryColor,
    "--pv-primary-soft": mix(surface, accent, dark ? 0.22 : 0.1),
    "--pv-primary-contrast": mix(surface, accent, dark ? 0.32 : 0.18),
    "--pv-secondary": ensureContrast(design.secondaryColor || text, surface, 4.5),
    "--pv-surface": surface,
    "--pv-bg": background,
    "--pv-surface-2": mix(surface, dark ? "#ffffff" : "#0f172a", dark ? 0.07 : 0.04),
    "--pv-text": text,
    "--pv-muted": muted,
    "--pv-border": border,
    "--pv-border-strong": borderStrong,
    "--pv-on-primary": button.fg,
    "--pv-btn": button.bg,
    "--pv-shadow-sm": `0 1px 2px ${shadowColor}`,
    "--pv-shadow": `0 1px 2px ${shadowColor}, 0 12px 28px -18px ${shadowColor}`,
    "--pv-shadow-lg": `0 2px 6px ${shadowColor}, 0 28px 60px -28px ${shadowColor}`,
    "--pv-radius": `${radius}px`,
    "--pv-radius-sm": `${Math.max(0, Math.round(radius * 0.6))}px`,
    "--pv-radius-lg": `${Math.min(40, Math.round(radius * 1.6))}px`,
    "--pv-font": FONT_STACKS[design.fontStyle] ?? FONT_STACKS.modern,
    background: background,
    color: text,
  } as CSSProperties;
}

/**
 * Renders a generated site the way visitors see it. Design tokens come from
 * the approved blueprint; content is data, rendered through safe components.
 *
 * Everything here is a server component — the chrome ships no JavaScript, so
 * public sites stay fast and work without hydration.
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
  const navCategories = categories.slice(0, 6);

  return (
    <div
      className="preview-root min-h-dvh flex flex-col"
      style={themeStyle(design)}
      data-fonts={`fonts-${design.fontStyle}`}
      data-cards={design.cardStyle}
      data-layout={design.layoutStyle}
      data-header={design.headerStyle}
      data-hero={design.heroStyle}
      data-density={design.cardDensity}
    >
      {previewBar}

      <a className="pv-skip" href="#pv-main">
        {homeLabel ?? siteName}
      </a>

      <header className="pv-header">
        <div className={`pv-header-inner ${container}`}>
          <Link href={basePath} className="pv-brand" aria-label={siteName}>
            <span className="pv-brand-mark" aria-hidden="true" />
            <span className="pv-brand-name">{siteName}</span>
          </Link>

          <nav aria-label={siteName} className="pv-nav">
            <Link href={basePath} className="pv-nav-link">
              {homeLabel ?? siteSlug}
            </Link>
            {navCategories.map((category) => (
              <Link key={category.id} href={`${basePath}/c/${category.slug}`} className="pv-nav-link">
                {category.name}
              </Link>
            ))}
          </nav>

          <div className="pv-header-actions">
            <Link href={`${basePath}/sitemap.xml`} className="pv-ghost-link">
              sitemap
            </Link>
          </div>
        </div>
      </header>

      <main id="pv-main" className={`pv-main ${container}`}>
        <div className={design.fontStyle === "modern" ? "pv-body" : "pv-prose"}>{children}</div>
      </main>

      <footer className="pv-footer">
        <div className={`pv-footer-inner ${container}`}>
          <div className="pv-footer-brand">
            <span className="pv-brand-name">{siteName}</span>
            {footerText ? <p className="pv-footer-text">{footerText}</p> : null}
          </div>
          {navCategories.length > 0 ? (
            <nav aria-label={siteName} className="pv-footer-nav">
              {navCategories.map((category) => (
                <Link key={category.id} href={`${basePath}/c/${category.slug}`}>
                  {category.name}
                </Link>
              ))}
            </nav>
          ) : null}
          <p className="pv-footer-meta">
            © {new Date().getFullYear()} {siteName} · {formatDate(new Date(), locale)}
          </p>
        </div>
      </footer>
    </div>
  );
}
