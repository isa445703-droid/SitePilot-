"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useT } from "@/lib/i18n/provider";
import { Field, Select } from "@/components/ui/field";

const AGENTS = ["orchestrator", "research", "writer", "editor", "seo", "analytics", "publisher"];

export function ActivityFilters({
  sites,
}: {
  sites: Array<{ id: string; name: string }>;
}) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  return (
    <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Field label={t("nav.sites")}>
        {({ id }) => (
          <Select
            id={id}
            value={params.get("site") ?? ""}
            onChange={(event) => update("site", event.target.value)}
          >
            <option value="">{t("common.all")}</option>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <Field label={t("activity.agent")}>
        {({ id }) => (
          <Select
            id={id}
            value={params.get("agent") ?? ""}
            onChange={(event) => update("agent", event.target.value)}
          >
            <option value="">{t("activity.filterAll")}</option>
            {AGENTS.map((agent) => (
              <option key={agent} value={agent}>
                {t(`activity.agents.${agent}`)}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <Field label={t("common.status")}>
        {({ id }) => (
          <Select
            id={id}
            value={params.get("status") ?? ""}
            onChange={(event) => update("status", event.target.value)}
          >
            <option value="">{t("activity.filterStatus")}</option>
            <option value="SUCCESS">{t("activity.success")}</option>
            <option value="FAILED">{t("activity.failed")}</option>
          </Select>
        )}
      </Field>
    </div>
  );
}
