import type { ReactNode } from "react";
import Link from "next/link";

/** Presentational building blocks shared by the public site and the dashboard
 *  preview so both look identical. No data access happens here. */

export type CardArticle = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  category: { id: string; name: string; slug: string } | null;
  /** Present on query results; the card renders the already formatted line. */
  publishedAt?: Date | null;
  updatedAt?: Date | null;
  createdAt?: Date | null;
};

export function SectionHead({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="pv-section-head">
      <h2>{title}</h2>
      {action ? <div className="pv-section-action">{action}</div> : null}
    </div>
  );
}

export function ArticleCard({
  article,
  href,
  categoryHref,
  meta,
  featured = false,
  status,
}: {
  article: CardArticle;
  href: string;
  categoryHref?: string;
  /** Formatted date line rendered under the excerpt. */
  meta?: string;
  featured?: boolean;
  /** Shown in the dashboard preview for content that is not published yet. */
  status?: string | null;
}) {
  return (
    <article className={featured ? "pv-card pv-card-featured" : "pv-card"}>
      {article.category && categoryHref ? (
        <Link href={categoryHref} className="pv-pill">
          {article.category.name}
        </Link>
      ) : null}
      <h3 className="pv-card-title">
        <Link href={href}>{article.title}</Link>
      </h3>
      {article.excerpt ? <p className="pv-card-excerpt">{article.excerpt}</p> : null}
      {meta || status ? (
        <p className="pv-meta">
          {status ? <span className="pv-status">{status}</span> : null}
          {meta}
        </p>
      ) : null}
      <span className="pv-more" aria-hidden="true">
        →
      </span>
    </article>
  );
}

export function Breadcrumbs({
  basePath,
  homeLabel,
  current,
  currentHref,
}: {
  basePath: string;
  homeLabel: string;
  current?: string;
  currentHref?: string;
}) {
  return (
    <nav className="pv-breadcrumbs" aria-label={homeLabel}>
      <Link href={basePath}>{homeLabel}</Link>
      {current ? (
        <>
          <span aria-hidden="true">/</span>
          {currentHref ? <Link href={currentHref}>{current}</Link> : <span className="pv-breadcrumb-current">{current}</span>}
        </>
      ) : null}
    </nav>
  );
}
