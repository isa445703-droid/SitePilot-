"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useT } from "@/lib/i18n/provider";

const RANGES = ["7", "30", "90"] as const;

/** Range + site switcher rendered as links (works without JS state). */
export function RangeTabs({ siteId }: { siteId: string }) {
  const t = useT();
  const params = useSearchParams();
  const pathname = usePathname();
  const active = params.get("range") ?? "30";

  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("analytics.range.30")}>
      {RANGES.map((range) => {
        const href = `${pathname}?site=${siteId}&range=${range}`;
        const isActive = active === range;
        return (
          <Link
            key={range}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={`chip ${isActive ? "!border-accent !bg-accent !text-white" : ""}`}
          >
            {t(`analytics.range.${range}`)}
          </Link>
        );
      })}
    </div>
  );
}
