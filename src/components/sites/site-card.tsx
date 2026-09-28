"use client";

import Link from "next/link";
import { Globe, Sparkles, ArrowUpRight } from "lucide-react";
import { useT } from "@/lib/i18n/provider";
import { formatRelativeTime, type Locale } from "@/lib/i18n/config";
import { Badge, StatusBadge } from "@/components/ui/badge";

type SiteLike = {
  id: string;
  name: string;
  description: string;
  status: string;
  autopilot: string;
  language: string;
  updatedAt: Date | string;
  isDemo: boolean;
  _count?: { articles: number; pages: number };
  schedule?: { enabled: boolean; nextRunAt: Date | string | null; frequency: string } | null;
};

export function SiteCard({ site, locale }: { site: SiteLike; locale: Locale }) {
  const t = useT();

  return (
    <article className="card group relative flex flex-col p-4 transition hover:border-line-strong sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
          <Globe className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {site.isDemo ? <Badge>{t("common.demoBadge")}</Badge> : null}
          <StatusBadge status={site.status} label={t(`sites.status.${site.status}`)} />
        </div>
      </div>

      <h3 className="mt-3 truncate text-base font-semibold">{site.name}</h3>
      <p className="mt-1 line-clamp-2 min-h-10 text-sm text-muted">{site.description || "—"}</p>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        <span>{t("content.count", { count: site._count?.articles ?? 0 })}</span>
        <span aria-hidden="true">·</span>
        <span>{site.language.toUpperCase()}</span>
        <span aria-hidden="true">·</span>
        <span suppressHydrationWarning>{formatRelativeTime(site.updatedAt, locale)}</span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3">
        <Badge tone={site.autopilot === "MANUAL" ? "neutral" : "success"}>
          <Sparkles className="h-3 w-3" aria-hidden="true" />
          {t(`sites.autopilot.${site.autopilot}`)}
        </Badge>
        <Link
          href={`/sites/${site.id}`}
          className="link inline-flex items-center gap-1 text-sm"
          aria-label={`${t("sites.openSite")} — ${site.name}`}
        >
          {t("sites.openSite")}
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
