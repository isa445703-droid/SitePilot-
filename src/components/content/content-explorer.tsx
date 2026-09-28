"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FilePlus2, Pencil, Plus, Search, Sparkles } from "lucide-react";
import { useI18n, useT } from "@/lib/i18n/provider";
import { api, errorMessage } from "@/lib/api/client";
import { Button, LinkButton } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/status";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";

export type ArticleRow = {
  id: string;
  title: string;
  slug: string;
  status: string;
  updatedAt: string | Date;
  wordCount: number;
  excerpt?: string;
  site: { id: string; name: string; language: string };
  category: { id: string; name: string } | null;
};

const STATUSES = ["DRAFT", "REVIEW", "APPROVED", "PUBLISHED"] as const;

export function ContentExplorer({
  articles,
  siteId,
  sites = [],
  title,
  subtitle,
  actions,
}: {
  articles: ArticleRow[];
  siteId?: string;
  sites?: Array<{ id: string; name: string }>;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  const t = useT();
  const { formatRelativeTime } = useI18n();
  const router = useRouter();
  const toast = useToast();

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string>("ALL");
  const [pickerFor, setPickerFor] = useState<null | "new" | "generate">(null);
  const [chosenSite, setChosenSite] = useState("");
  const [generating, setGenerating] = useState(false);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return articles.filter((article) => {
      if (status !== "ALL" && article.status !== status) return false;
      if (!needle) return true;
      return (
        article.title.toLowerCase().includes(needle) ||
        (article.excerpt ?? "").toLowerCase().includes(needle) ||
        article.site.name.toLowerCase().includes(needle)
      );
    });
  }, [articles, query, status]);

  const openPicker = (kind: "new" | "generate") => {
    if (siteId) {
      if (kind === "new") router.push(`/content/new?site=${siteId}`);
      else void runGenerate(siteId);
      return;
    }
    setChosenSite(sites[0]?.id ?? "");
    setPickerFor(kind);
  };

  const runGenerate = async (targetSite: string) => {
    setGenerating(true);
    try {
      await api.post(`/api/sites/${targetSite}/articles/generate`, {});
      toast.success(t("schedule.taskCreated"));
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error, t));
    } finally {
      setGenerating(false);
      setPickerFor(null);
    }
  };

  const confirmPicker = () => {
    if (!chosenSite) return;
    if (pickerFor === "new") {
      router.push(`/content/new?site=${chosenSite}`);
      setPickerFor(null);
      return;
    }
    void runGenerate(chosenSite);
  };

  const actionButtons = (
    <>
      <Button
        variant="primary"
        onClick={() => openPicker("generate")}
        loading={generating}
        icon={<Sparkles className="h-4 w-4" />}
      >
        {generating ? t("common.aiWorking") : t("editor.generateWithAI")}
      </Button>
      <Button onClick={() => openPicker("new")} icon={<Plus className="h-4 w-4" />}>
        {t("content.newArticle")}
      </Button>
    </>
  );

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          {title ? <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h1> : null}
          {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">{actions ?? actionButtons}</div>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-faint"
            aria-hidden="true"
          />
          <Input
            className="ps-9"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("content.searchPlaceholder")}
            aria-label={t("common.search")}
          />
        </div>
        <div className="scrollbar-none flex gap-1.5 overflow-x-auto" role="group" aria-label={t("common.status")}>
          <button type="button" className="chip" aria-pressed={status === "ALL"} onClick={() => setStatus("ALL")}>
            {t("content.filters.all")}
          </button>
          {STATUSES.map((item) => (
            <button
              key={item}
              type="button"
              className="chip"
              aria-pressed={status === item}
              onClick={() => setStatus(item)}
            >
              {t(`content.filters.${item}`)}
            </button>
          ))}
        </div>
      </div>

      <p className="mb-2 text-xs text-faint">{t("content.count", { count: filtered.length })}</p>

      {filtered.length === 0 ? (
        <EmptyState
          title={articles.length === 0 ? t("content.emptyTitle") : t("content.noResults")}
          body={articles.length === 0 ? t("content.emptyBody") : undefined}
          action={
            articles.length === 0 ? (
              <Button variant="primary" onClick={() => openPicker("generate")} icon={<Sparkles className="h-4 w-4" />}>
                {t("editor.generateWithAI")}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="card hidden overflow-hidden md:block">
            <table className="w-full text-sm">
              <thead className="border-b border-line bg-surface-2 text-start">
                <tr className="text-start">
                  <th scope="col" className="px-4 py-2.5 text-start text-xs font-semibold uppercase tracking-wide text-faint">
                    {t("content.columns.title")}
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-start text-xs font-semibold uppercase tracking-wide text-faint">
                    {t("content.columns.site")}
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-start text-xs font-semibold uppercase tracking-wide text-faint">
                    {t("content.columns.status")}
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-start text-xs font-semibold uppercase tracking-wide text-faint">
                    {t("content.columns.updated")}
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-end text-xs font-semibold uppercase tracking-wide text-faint">
                    {t("content.columns.actions")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.map((article) => (
                  <tr key={article.id} className="transition hover:bg-surface-2">
                    <td className="max-w-0 px-4 py-3">
                      <Link href={`/content/${article.id}`} className="block truncate font-medium hover:text-accent">
                        {article.title}
                      </Link>
                      <span className="block truncate text-xs text-muted">
                        {t("editor.wordCount", { count: article.wordCount })}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted">{article.site.name}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <StatusBadge status={article.status} label={t(`editor.status.${article.status}`)} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted">
                      <span suppressHydrationWarning>
                        {formatRelativeTime(article.updatedAt)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-end">
                      <LinkButton href={`/content/${article.id}`} size="sm" variant="ghost" aria-label={t("common.edit")}>
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                        {t("common.edit")}
                      </LinkButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="space-y-2.5 md:hidden">
            {filtered.map((article) => (
              <li key={article.id} className="card p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/content/${article.id}`} className="min-w-0 flex-1 font-medium hover:text-accent">
                    {article.title}
                  </Link>
                  <StatusBadge status={article.status} label={t(`editor.status.${article.status}`)} />
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                  <span>{article.site.name}</span>
                  <span aria-hidden="true">·</span>
                  <span suppressHydrationWarning>{formatRelativeTime(article.updatedAt)}</span>
                  <span aria-hidden="true">·</span>
                  <span>{t("editor.wordCount", { count: article.wordCount })}</span>
                </div>
                <div className="mt-2.5 flex flex-col gap-2 sm:flex-row">
                  <LinkButton href={`/content/${article.id}`} size="sm" block className="sm:w-auto" variant="primary">
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                    {t("common.edit")}
                  </LinkButton>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <Dialog
        open={pickerFor !== null}
        onClose={() => setPickerFor(null)}
        title={pickerFor === "new" ? t("content.newArticle") : t("editor.generateWithAI")}
        description={t("sites.subtitle")}
        footer={
          <>
            <Button onClick={() => setPickerFor(null)}>{t("common.cancel")}</Button>
            <Button variant="primary" onClick={confirmPicker} loading={generating} disabled={!chosenSite}>
              {pickerFor === "new" ? t("common.create") : t("common.generate")}
            </Button>
          </>
        }
      >
        <Field label={t("nav.sites")}>
          {({ id }) => (
            <Select id={id} value={chosenSite} onChange={(event) => setChosenSite(event.target.value)}>
              <option value="">—</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {pickerFor === "generate" ? (
          <div className="mt-3 flex items-center gap-2 text-xs text-muted">
            <FilePlus2 className="h-4 w-4" aria-hidden="true" />
            {t("onboarding.aiNotice")}
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
