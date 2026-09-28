"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Eye, ExternalLink } from "lucide-react";
import { useT } from "@/lib/i18n/provider";

const TABS = [
  { key: "overview", suffix: "" },
  { key: "content", suffix: "/content" },
  { key: "blueprint", suffix: "/blueprint" },
  { key: "schedule", suffix: "/schedule" },
  { key: "seo", suffix: "/seo" },
  { key: "settings", suffix: "/settings" },
] as const;

export function SiteTabs({ siteId }: { siteId: string }) {
  const t = useT();
  const pathname = usePathname();
  const base = `/sites/${siteId}`;

  return (
    <nav
      aria-label={t("nav.site")}
      className="scrollbar-none -mx-3 mb-4 overflow-x-auto border-b border-line px-3 sm:mx-0 sm:px-0"
    >
      <ul className="flex min-w-max gap-1 pb-px">
        {TABS.map((tab) => {
          const href = `${base}${tab.suffix}`;
          const active = pathname === href;
          return (
            <li key={tab.key}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? "border-accent text-accent"
                    : "border-transparent text-muted hover:text-ink"
                }`}
              >
                {t(`site.tabs.${tab.key}`)}
              </Link>
            </li>
          );
        })}
        <li className="ms-auto hidden sm:block">
          <Link
            href={`/preview/${siteId}`}
            className="inline-flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium text-muted hover:text-ink"
          >
            <Eye className="h-4 w-4" aria-hidden="true" />
            {t("nav.preview")}
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </li>
      </ul>
    </nav>
  );
}
