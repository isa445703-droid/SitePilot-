"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import {
  ArrowLeft,
  Eye,
  Save,
  Search,
  Send,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";
import { useI18n, useT } from "@/lib/i18n/provider";
import { api, errorMessage } from "@/lib/api/client";
import { Button, LinkButton } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";

export type EditorArticle = {
  id: string;
  siteId: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  status: string;
  seoTitle: string;
  seoDescription: string;
  tags: string[];
  categoryId: string | null;
  language: string;
  author: string;
  wordCount: number;
  publishedAt: string | null;
  updatedAt: string;
};

type Values = {
  title: string;
  excerpt: string;
  content: string;
  categoryId: string;
  tags: string;
  seoTitle: string;
  seoDescription: string;
};

export function ArticleEditor({
  article,
  siteId,
  categories,
  siteLanguage,
  siteName,
  isNew = false,
}: {
  article: EditorArticle | null;
  siteId: string;
  categories: Array<{ id: string; name: string }>;
  siteLanguage: string;
  siteName: string;
  isNew?: boolean;
}) {
  const t = useT();
  const { formatRelativeTime, formatDateTime } = useI18n();
  const router = useRouter();
  const toast = useToast();

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [aiAction, setAiAction] = useState<null | "generate" | "improve" | "rewrite" | "seo">(null);
  const [instruction, setInstruction] = useState("");
  const [instructionOpen, setInstructionOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<Values>({
    defaultValues: {
      title: article?.title ?? "",
      excerpt: article?.excerpt ?? "",
      content: article?.content ?? "",
      categoryId: article?.categoryId ?? "",
      tags: (article?.tags ?? []).join(", "),
      seoTitle: article?.seoTitle ?? "",
      seoDescription: article?.seoDescription ?? "",
    },
  });

  const content = watch("content");
  const words = content.trim() ? content.trim().split(/\s+/).length : 0;

  useEffect(() => {
    if (article) {
      reset({
        title: article.title,
        excerpt: article.excerpt,
        content: article.content,
        categoryId: article.categoryId ?? "",
        tags: article.tags.join(", "),
        seoTitle: article.seoTitle,
        seoDescription: article.seoDescription,
      });
    }
  }, [article, reset]);

  const toValues = (data: Values) => ({
    title: data.title.trim(),
    excerpt: data.excerpt.trim(),
    content: data.content,
    categoryId: data.categoryId || null,
    tags: data.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 12),
    seoTitle: data.seoTitle.trim(),
    seoDescription: data.seoDescription.trim(),
  });

  const save = async (data: Values): Promise<string | null> => {
    setSaving(true);
    setError(null);
    try {
      if (isNew) {
        const created = await api.post<{ id: string }>(`/api/sites/${siteId}/articles`, {
          ...toValues(data),
          status: "DRAFT",
        });
        toast.success(t("common.saved"));
        router.replace(`/content/${created.id}`);
        return created.id;
      }
      await api.patch(`/api/articles/${article!.id}`, toValues(data));
      toast.success(t("common.saved"));
      router.refresh();
      return article!.id;
    } catch (caught) {
      setError(errorMessage(caught, t));
      return null;
    } finally {
      setSaving(false);
    }
  };

  const runAi = async (
    action: "generate" | "improve" | "rewrite" | "seo",
    data: Values,
  ) => {
    setError(null);
    const targetId = isNew ? await save(data) : article?.id;
    if (!targetId) return;

    setAiAction(action);
    try {
      if (action === "generate") {
        const result = await api.post<{ article: EditorArticle; isDemo: boolean }>(
          `/api/articles/${targetId}/generate`,
          { instruction: instruction || undefined },
        );
        const updated = result.article;
        reset({
          title: updated.title,
          excerpt: updated.excerpt,
          content: updated.content,
          categoryId: updated.categoryId ?? "",
          tags: updated.tags.join(", "),
          seoTitle: updated.seoTitle,
          seoDescription: updated.seoDescription,
        });
        toast.success(t("common.saved"));
      } else if (action === "seo") {
        await api.post(`/api/articles/${targetId}/seo`, {});
        const refreshed = await api.get<EditorArticle>(`/api/articles/${targetId}`);
        reset((current) => ({
          ...current,
          seoTitle: refreshed.seoTitle,
          seoDescription: refreshed.seoDescription,
          tags: refreshed.tags.join(", "),
        }));
        toast.success(t("seo.title"));
      } else {
        await api.post(`/api/articles/${targetId}/improve`, {
          mode: action === "rewrite" ? "rewrite" : "improve",
          instruction: instruction || undefined,
        });
        const refreshed = await api.get<EditorArticle>(`/api/articles/${targetId}`);
        reset({
          title: refreshed.title,
          excerpt: refreshed.excerpt,
          content: refreshed.content,
          categoryId: refreshed.categoryId ?? "",
          tags: refreshed.tags.join(", "),
          seoTitle: refreshed.seoTitle,
          seoDescription: refreshed.seoDescription,
        });
        toast.success(t("common.saved"));
      }
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught, t, "editor.aiError"));
    } finally {
      setAiAction(null);
    }
  };

  const publish = async (action: "publish" | "unpublish" | "approve") => {
    if (!article) return;
    setError(null);
    try {
      await api.post(`/api/articles/${article.id}`, { action });
      toast.success(action === "publish" ? t("editor.published") : t("common.saved"));
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught, t));
    }
  };

  const fieldIssues = {} as Record<string, string>;

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <LinkButton
          href={siteId ? `/sites/${siteId}/content` : "/content"}
          size="sm"
          variant="ghost"
          icon={<ArrowLeft className="h-4 w-4" />}
        >
          {t("editor.backToContent")}
        </LinkButton>
        {article ? (
          <div className="flex items-center gap-2">
            <StatusBadge status={article.status} label={t(`editor.status.${article.status}`)} />
            {article.publishedAt ? (
              <span className="hidden text-xs text-muted sm:inline">
                {formatDateTime(article.publishedAt)}
              </span>
            ) : (
              <span className="hidden text-xs text-faint sm:inline" suppressHydrationWarning>
                {formatRelativeTime(article.updatedAt)}
              </span>
            )}
          </div>
        ) : null}
      </div>

      {error ? (
        <Alert
          tone="danger"
          role="alert"
          className="mb-4"
          actions={
            <Button size="sm" onClick={() => setError(null)}>
              {t("common.close")}
            </Button>
          }
        >
          {error}
        </Alert>
      ) : null}

      <form onSubmit={handleSubmit(save)} noValidate className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardBody className="space-y-4">
              <Field label={t("editor.title")} error={errors.title?.message ?? fieldIssues.title}>
                {({ id, describedBy }) => (
                  <Input
                    id={id}
                    aria-describedby={describedBy}
                    placeholder={t("editor.titlePlaceholder")}
                    invalid={Boolean(errors.title)}
                    {...register("title", {
                      required: t("editor.emptyTitleHelp"),
                      maxLength: { value: 200, message: t("errors.validation") },
                    })}
                  />
                )}
              </Field>

              <Field label={t("editor.excerpt")} help={t("editor.excerptPlaceholder")}>
                {({ id, describedBy }) => (
                  <Textarea
                    id={id}
                    aria-describedby={describedBy}
                    rows={2}
                    {...register("excerpt")}
                  />
                )}
              </Field>

              <Field
                label={
                  <span className="inline-flex items-center justify-between w-full">
                    <span>{t("editor.body")}</span>
                    <span className="text-xs font-normal text-faint tabular">
                      {t("editor.wordCount", { count: words })}
                    </span>
                  </span>
                }
              >
                {({ id }) => (
                  <Textarea
                    id={id}
                    rows={20}
                    className="font-mono text-[13px] leading-relaxed"
                    placeholder={t("editor.bodyPlaceholder")}
                    {...register("content")}
                  />
                )}
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title={t("editor.generateWithAI")}
              description={t("schedule.autoloop")}
              level={3}
              actions={
                <Badge tone="accent">
                  <Sparkles className="h-3 w-3" aria-hidden="true" />
                  {siteName}
                </Badge>
              }
            />
            <CardBody className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Button
                  variant="primary"
                  loading={aiAction === "generate"}
                  onClick={handleSubmit((data) => runAi("generate", data))}
                  icon={<Sparkles className="h-4 w-4" />}
                >
                  {t("editor.generateWithAI")}
                </Button>
                <Button
                  loading={aiAction === "improve"}
                  onClick={handleSubmit((data) => runAi("improve", data))}
                  icon={<Wand2 className="h-4 w-4" />}
                >
                  {t("editor.improve")}
                </Button>
                <Button
                  loading={aiAction === "rewrite"}
                  onClick={handleSubmit((data) => runAi("rewrite", data))}
                  icon={<Wand2 className="h-4 w-4" />}
                >
                  {t("editor.rewrite")}
                </Button>
                <Button
                  loading={aiAction === "seo"}
                  onClick={handleSubmit((data) => runAi("seo", data))}
                  icon={<Search className="h-4 w-4" />}
                >
                  {t("editor.seoOptimize")}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setInstructionOpen((value) => !value)}
                  aria-expanded={instructionOpen}
                >
                  {t("editor.aiPrompt")}
                </Button>
              </div>

              {instructionOpen ? (
                <Field label={t("editor.aiPrompt")} help={t("editor.aiPromptPlaceholder")}>
                  {({ id }) => (
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Input
                        id={id}
                        value={instruction}
                        placeholder={t("editor.aiPromptPlaceholder")}
                        onChange={(event) => setInstruction(event.target.value)}
                      />
                      <Button onClick={() => setInstructionOpen(false)} icon={<X className="h-4 w-4" />}>
                        {t("common.close")}
                      </Button>
                    </div>
                  )}
                </Field>
              ) : null}
            </CardBody>
          </Card>
        </div>

        {/* Side column */}
        <div className="space-y-4">
          <Card>
            <CardHeader title={t("common.status")} level={3} />
            <CardBody className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="submit"
                  variant="primary"
                  loading={saving}
                  icon={<Save className="h-4 w-4" />}
                  block
                >
                  {saving ? t("common.saving") : isNew ? t("common.create") : t("common.save")}
                </Button>
              </div>
              {article ? (
                <div className="grid grid-cols-1 gap-2">
                  {article.status !== "PUBLISHED" ? (
                    <Button
                      variant="secondary"
                      onClick={() => publish("publish")}
                      icon={<Send className="h-4 w-4" />}
                      block
                    >
                      {t("editor.publish")}
                    </Button>
                  ) : (
                    <Button variant="secondary" onClick={() => publish("unpublish")} block>
                      {t("editor.unpublish")}
                    </Button>
                  )}
                  {siteName ? (
                    <LinkButton
                      href={`/preview/${siteId}/a/${article.slug}`}
                      variant="ghost"
                      block
                      icon={<Eye className="h-4 w-4" />}
                    >
                      {t("nav.preview")}
                    </LinkButton>
                  ) : null}
                </div>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t("site.tabs.settings")} level={3} />
            <CardBody className="space-y-3">
              <Field label={t("editor.category")}>
                {({ id }) => (
                  <Select id={id} {...register("categoryId")}>
                    <option value="">{t("editor.noCategory")}</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>

              <Field label={t("editor.tags")} help={t("editor.tagsHelp")}>
                {({ id }) => <Input id={id} {...register("tags")} />}
              </Field>

              <Field label={t("editor.slug")}>
                {({ id }) => <Input id={id} value={article?.slug ?? ""} readOnly />}
              </Field>

              <div className="text-xs text-muted">
                <p>
                  {t("common.language")}: <strong>{siteLanguage.toUpperCase()}</strong>
                </p>
                {article ? (
                  <p>
                    {t("editor.author")}: <strong>{article.author}</strong>
                  </p>
                ) : null}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t("seo.title")} level={3} />
            <CardBody className="space-y-3">
              <Field label={t("editor.seoTitle")}>
                {({ id }) => <Input id={id} maxLength={70} {...register("seoTitle")} />}
              </Field>
              <Field label={t("editor.seoDescription")}>
                {({ id }) => <Textarea id={id} rows={3} maxLength={180} {...register("seoDescription")} />}
              </Field>
              <p className="text-xs text-faint">
                {t("editor.wordCount", { count: words })} · {siteName}
                {article ? (
                  <span suppressHydrationWarning> · {formatRelativeTime(article.updatedAt)}</span>
                ) : null}
              </p>
            </CardBody>
          </Card>
        </div>
      </form>

      <div className="mt-4 flex justify-center">
        <Link className="link text-sm" href={`/activity?site=${siteId}`}>
          {t("nav.activity")}
        </Link>
      </div>
    </div>
  );
}
