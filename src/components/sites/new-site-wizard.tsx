"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  Globe,
  Layers,
  Loader2,
  RefreshCw,
  Rocket,
  Sparkles,
  Wand2,
} from "lucide-react";
import { useT } from "@/lib/i18n/provider";
import { api, errorMessage } from "@/lib/api/client";
import type { Blueprint } from "@/lib/ai/schemas";
import { Button, LinkButton } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { BlueprintEditor } from "@/components/sites/blueprint-editor";
import { useToast } from "@/components/ui/toast";

type Step = "describe" | "blueprint" | "generate" | "autopilot";

const STEP_ORDER: Step[] = ["describe", "blueprint", "generate", "autopilot"];
const STEP_LABEL_KEY: Record<Step, string> = {
  describe: "onboarding.stepDescribe",
  blueprint: "onboarding.stepBlueprint",
  generate: "onboarding.stepGenerate",
  autopilot: "onboarding.stepAutopilot",
};

const CONTENT_LANGUAGES = ["en", "ru", "ko", "de", "es", "fr", "ja"];

const TIMEZONES = [
  "UTC",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Moscow",
  "Europe/Helsinki",
  "America/New_York",
  "America/Los_Angeles",
  "Asia/Seoul",
  "Asia/Tokyo",
  "Asia/Dubai",
  "Australia/Sydney",
];

const GENERATE_STEPS = [
  "blueprint",
  "categories",
  "pages",
  "plan",
  "articles",
  "seo",
  "schedule",
] as const;

export function NewSiteWizard() {
  const t = useT();
  const router = useRouter();
  const toast = useToast();

  const [step, setStep] = useState<Step>("describe");
  const [brief, setBrief] = useState("");
  const [designBrief, setDesignBrief] = useState("");
  const [name, setName] = useState("");
  const [language, setLanguage] = useState("en");
  const [timezone, setTimezone] = useState("UTC");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "analyzing" | "saving" | "generating" | "autopilot">(null);

  const [siteId, setSiteId] = useState<string | null>(null);
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [progressIndex, setProgressIndex] = useState(0);
  const [mode, setMode] = useState<"MANUAL" | "REVIEW" | "FULL">("REVIEW");
  const timers = useRef<Array<number | ReturnType<typeof setInterval>>>([]);

  useEffect(() => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (detected) setTimezone(detected);
  }, []);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending) clearInterval(timer as never);
    };
  }, []);

  const stepIndex = STEP_ORDER.indexOf(step);

  const analyze = useCallback(async () => {
    setError(null);
    setFieldError(null);
    if (brief.trim().length < 20) {
      setFieldError(t("onboarding.briefHelp"));
      return;
    }
    setBusy("analyzing");
    try {
      const site = await api.post<{ id: string }>("/api/sites", {
        brief: brief.trim(),
        name: name.trim() || undefined,
        designBrief: designBrief.trim() || undefined,
        language,
        timezone,
      });
      setSiteId(site.id);
      const result = await api.post<{ blueprint: Blueprint; isDemo: boolean }>(
        `/api/sites/${site.id}/blueprint`,
        {},
      );
      setBlueprint(result.blueprint);
      setIsDemo(result.isDemo);
      setStep("blueprint");
    } catch (caught) {
      setError(errorMessage(caught, t));
    } finally {
      setBusy(null);
    }
  }, [brief, designBrief, name, language, timezone, t]);

  const regenerate = useCallback(async () => {
    if (!siteId) return;
    setError(null);
    setBusy("analyzing");
    try {
      const result = await api.post<{ blueprint: Blueprint; isDemo: boolean }>(
        `/api/sites/${siteId}/blueprint`,
        {},
      );
      setBlueprint(result.blueprint);
      setIsDemo(result.isDemo);
      toast.success(t("common.saved"));
    } catch (caught) {
      setError(errorMessage(caught, t));
    } finally {
      setBusy(null);
    }
  }, [siteId, t, toast]);

  const approveAndGenerate = useCallback(async () => {
    if (!siteId || !blueprint) return;
    setError(null);
    setBusy("saving");
    setStep("generate");
    setProgressIndex(0);

    const ticker = window.setInterval(() => {
      setProgressIndex((current) => Math.min(current + 1, GENERATE_STEPS.length - 2));
    }, 900);
    timers.current.push(ticker);

    try {
      await api.put(`/api/sites/${siteId}/blueprint`, { blueprint });
      await api.post(`/api/sites/${siteId}/generate`, { timezone });
      window.clearInterval(ticker);
      setProgressIndex(GENERATE_STEPS.length - 1);
      await new Promise((resolve) => setTimeout(resolve, 450));
      setStep("autopilot");
    } catch (caught) {
      window.clearInterval(ticker);
      setError(errorMessage(caught, t));
      setStep("blueprint");
    } finally {
      setBusy(null);
    }
  }, [siteId, blueprint, timezone, t]);

  const finish = useCallback(
    async (skip = false) => {
      if (!siteId) return;
      if (skip) {
        router.push(`/sites/${siteId}`);
        return;
      }
      setBusy("autopilot");
      setError(null);
      try {
        await api.post(`/api/sites/${siteId}/autopilot`, { mode });
        toast.success(
          mode === "MANUAL" ? t("schedule.disabled") : t("schedule.enabled"),
        );
        router.push(`/sites/${siteId}`);
      } catch (caught) {
        setError(errorMessage(caught, t));
      } finally {
        setBusy(null);
      }
    },
    [siteId, mode, router, t, toast],
  );

  const modeOptions = useMemo(
    () => [
      { value: "MANUAL" as const, title: t("onboarding.manual"), body: t("onboarding.manualDesc") },
      { value: "REVIEW" as const, title: t("onboarding.review"), body: t("onboarding.reviewDesc") },
      { value: "FULL" as const, title: t("onboarding.full"), body: t("onboarding.fullDesc") },
    ],
    [t],
  );

  return (
    <div className="mx-auto w-full max-w-4xl">
      <PageHeader
        title={t("sites.create")}
        description={t("onboarding.briefHelp")}
        actions={
          <LinkButton href="/sites" variant="ghost" size="sm" icon={<ArrowLeft className="h-4 w-4" />}>
            {t("common.back")}
          </LinkButton>
        }
      />

      {/* Progress */}
      <ol className="mb-6 grid grid-cols-4 gap-2" aria-label={t("common.step", { current: stepIndex + 1, total: 4 })}>
        {STEP_ORDER.map((item, index) => {
          const state = index < stepIndex ? "done" : index === stepIndex ? "current" : "todo";
          return (
            <li key={item} className="min-w-0">
              <div
                className={`h-1.5 rounded-full ${
                  state === "todo" ? "bg-surface-2" : "bg-accent"
                }`}
                aria-hidden="true"
              />
              <p
                className={`mt-1.5 truncate text-xs font-medium ${
                  state === "current" ? "text-accent" : state === "done" ? "text-ink" : "text-faint"
                }`}
              >
                {index + 1}. {t(STEP_LABEL_KEY[item])}
              </p>
            </li>
          );
        })}
      </ol>

      {error ? (
        <Alert tone="danger" role="alert" className="mb-4" actions={
          <Button size="sm" variant="secondary" onClick={() => setError(null)}>
            {t("common.close")}
          </Button>
        }>
          {error}
        </Alert>
      ) : null}

      {isDemo ? (
        <Alert tone="warning" className="mb-4">
          {t("onboarding.aiNotice")}
        </Alert>
      ) : null}

      {/* Step 1 — describe */}
      {step === "describe" ? (
        <Card>
          <CardHeader title={t("onboarding.briefLabel")} description={t("onboarding.briefHelp")} />
          <CardBody className="space-y-4">
            <Field
              label={t("onboarding.briefLabel")}
              error={fieldError ?? undefined}
            >
              {({ id, describedBy }) => (
                <Textarea
                  id={id}
                  aria-describedby={describedBy}
                  rows={7}
                  value={brief}
                  invalid={Boolean(fieldError)}
                  placeholder={t("onboarding.briefPlaceholder")}
                  onChange={(event) => setBrief(event.target.value)}
                />
              )}
            </Field>

            <Field
              label={t("onboarding.designBriefLabel")}
              help={t("onboarding.designBriefHelp")}
            >
              {({ id, describedBy }) => (
                <Textarea
                  id={id}
                  aria-describedby={describedBy}
                  rows={3}
                  value={designBrief}
                  placeholder={t("onboarding.designBriefPlaceholder")}
                  onChange={(event) => setDesignBrief(event.target.value)}
                />
              )}
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label={`${t("onboarding.nameLabel")}`} optionalLabel={t("common.optional")}>
                {({ id }) => (
                  <Input
                    id={id}
                    value={name}
                    placeholder={t("onboarding.namePlaceholder")}
                    onChange={(event) => setName(event.target.value)}
                  />
                )}
              </Field>

              <Field label={t("onboarding.contentLanguageLabel")} help={t("onboarding.contentLanguageHelp")}>
                {({ id }) => (
                  <Select id={id} value={language} onChange={(event) => setLanguage(event.target.value)}>
                    {CONTENT_LANGUAGES.map((code) => (
                      <option key={code} value={code}>
                        {code.toUpperCase()}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>

              <Field label={t("onboarding.timezoneLabel")}>
                {({ id }) => (
                  <Select id={id} value={timezone} onChange={(event) => setTimezone(event.target.value)}>
                    {Array.from(new Set([timezone, ...TIMEZONES])).map((zone) => (
                      <option key={zone} value={zone}>
                        {zone}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>

            <div className="flex justify-end">
              <Button
                variant="primary"
                size="lg"
                loading={busy === "analyzing"}
                onClick={analyze}
                iconRight={<ArrowRight className="h-4 w-4" />}
              >
                {busy === "analyzing" ? t("common.aiWorking") : t("common.continue")}
              </Button>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {/* Step 2 — blueprint review */}
      {step === "blueprint" && blueprint ? (
        <div className="space-y-4">
          <Card>
            <CardHeader
              title={
                <span className="inline-flex items-center gap-2">
                  <Layers className="h-4 w-4 text-accent" aria-hidden="true" />
                  {t("onboarding.blueprintTitle")}
                </span>
              }
              description={t("onboarding.blueprintHelp")}
              actions={
                <Button
                  size="sm"
                  onClick={regenerate}
                  loading={busy === "analyzing"}
                  icon={<RefreshCw className="h-4 w-4" />}
                >
                  {t("onboarding.regenerate")}
                </Button>
              }
            />
            <CardBody className="flex flex-wrap gap-2">
              <Badge tone="accent">{blueprint.categories.length} {t("blueprint.categories")}</Badge>
              <Badge tone="accent">{blueprint.pages.length} {t("blueprint.pages")}</Badge>
              <Badge>{blueprint.contentTypes.length} {t("blueprint.contentTypes")}</Badge>
              <Badge>{t(`schedule.frequencies.${blueprint.publishingFrequency}`)}</Badge>
              <Badge>{blueprint.language.toUpperCase()}</Badge>
            </CardBody>
          </Card>

          <BlueprintEditor value={blueprint} onChange={setBlueprint} disabled={busy !== null} />

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button
              variant="ghost"
              onClick={() => setStep("describe")}
              disabled={busy !== null}
              icon={<ArrowLeft className="h-4 w-4" />}
            >
              {t("common.back")}
            </Button>
            <Button
              variant="primary"
              size="lg"
              loading={busy === "saving"}
              onClick={approveAndGenerate}
              iconRight={<ArrowRight className="h-4 w-4" />}
            >
              {t("onboarding.approve")}
            </Button>
          </div>
        </div>
      ) : null}

      {/* Step 3 — generate */}
      {step === "generate" ? (
        <Card>
          <CardHeader
            title={t("onboarding.generating")}
            description={t("onboarding.generateSteps.plan")}
          />
          <CardBody>
            <ol className="space-y-2.5" aria-live="polite">
              {GENERATE_STEPS.map((key, index) => {
                const done = index < progressIndex || busy === null;
                const active = index === progressIndex && busy !== null;
                return (
                  <li key={key} className="flex items-center gap-3">
                    <span
                      className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border text-xs ${
                        done
                          ? "border-success/40 bg-success-soft text-success"
                          : active
                            ? "border-accent/40 bg-accent-soft text-accent"
                            : "border-line bg-surface-2 text-faint"
                      }`}
                      aria-hidden="true"
                    >
                      {done ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : active ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        index + 1
                      )}
                    </span>
                    <span
                      className={`text-sm ${
                        done || active ? "text-ink" : "text-faint"
                      }`}
                    >
                      {t(`onboarding.generateSteps.${key}`)}
                    </span>
                  </li>
                );
              })}
            </ol>
          </CardBody>
        </Card>
      ) : null}

      {/* Step 4 — autopilot */}
      {step === "autopilot" ? (
        <div className="space-y-4">
          <Card>
            <CardHeader
              title={
                <span className="inline-flex items-center gap-2">
                  <Rocket className="h-4 w-4 text-accent" aria-hidden="true" />
                  {t("onboarding.autopilotTitle")}
                </span>
              }
              description={t("onboarding.autopilotHelp")}
            />
            <CardBody className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {modeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={mode === option.value}
                  onClick={() => setMode(option.value)}
                  className={`card-flat p-4 text-start transition ${
                    mode === option.value
                      ? "border-accent bg-accent-soft"
                      : "hover:border-line-strong"
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{option.title}</span>
                    {mode === option.value ? (
                      <Check className="h-4 w-4 text-accent" aria-hidden="true" />
                    ) : null}
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-muted">
                    {option.body}
                  </span>
                </button>
              ))}
            </CardBody>
          </Card>

          <Card flat>
            <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-sm text-muted">
                <Eye className="h-4 w-4 text-accent" aria-hidden="true" />
                {t("onboarding.previewHelp")}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <LinkButton href={siteId ? `/preview/${siteId}` : "#"} variant="secondary">
                  {t("nav.preview")}
                </LinkButton>
                <Button variant="ghost" onClick={() => finish(true)} disabled={busy !== null}>
                  {t("onboarding.skip")}
                </Button>
                <Button
                  variant="primary"
                  loading={busy === "autopilot"}
                  onClick={() => finish(false)}
                  iconRight={<ArrowRight className="h-4 w-4" />}
                >
                  {t("onboarding.finish")}
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>
      ) : null}

      {siteId ? (
        <p className="mt-4 text-center text-xs text-faint">
          <Link className="link" href={`/sites/${siteId}`}>
            <Globe className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
            {t("onboarding.siteReady")}
          </Link>
          <span className="mx-2">·</span>
          <Link className="link" href="/sites/new">
            <Wand2 className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
            {t("sites.create")}
          </Link>
          <span className="mx-2">·</span>
          <Sparkles className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
          {t("common.step", { current: stepIndex + 1, total: 4 })}
        </p>
      ) : null}
    </div>
  );
}
