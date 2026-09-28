"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, Check, Clock, Plus, RefreshCw, Zap } from "lucide-react";
import { useI18n, useT } from "@/lib/i18n/provider";
import { api, errorMessage } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/status";
import { useToast } from "@/components/ui/toast";

type Mode = "MANUAL" | "REVIEW" | "FULL";

export type TaskRow = {
  id: string;
  type: string;
  status: string;
  scheduledAt: string;
  error?: string | null;
  site?: { id: string; name: string };
};

type Props = {
  siteId: string;
  site: {
    id: string;
    autopilot: string;
    frequency: string;
    timezone: string;
    publishHour: number;
    name: string;
  };
  schedule: {
    enabled: boolean;
    nextRunAt: string | null;
    frequency: string;
    timezone: string;
    publishHour: number;
  } | null;
  tasks: TaskRow[];
};

const FREQUENCIES = ["ONCE_A_WEEK", "TWICE_A_WEEK", "THREE_A_WEEK", "FIVE_A_WEEK", "DAILY"];

export function ScheduleManager({ site, schedule, tasks }: Props) {
  const t = useT();
  const { formatDateTime, formatRelativeTime } = useI18n();
  const router = useRouter();
  const toast = useToast();

  const [frequency, setFrequency] = useState(schedule?.frequency ?? site.frequency);
  const [timezone, setTimezone] = useState(schedule?.timezone ?? site.timezone);
  const [publishHour, setPublishHour] = useState(schedule?.publishHour ?? site.publishHour);
  const [mode, setMode] = useState<Mode>(site.autopilot as Mode);
  const [busy, setBusy] = useState<null | "schedule" | "autopilot" | "task">(null);
  const [error, setError] = useState<string | null>(null);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [taskType, setTaskType] = useState("GENERATE_ARTICLE");
  const [taskTitle, setTaskTitle] = useState("");

  const saveSchedule = async () => {
    setBusy("schedule");
    setError(null);
    try {
      await api.post(`/api/sites/${site.id}/schedule`, {
        frequency,
        timezone,
        publishHour: Number(publishHour),
        enabled: mode !== "MANUAL",
      });
      toast.success(t("schedule.scheduleSaved"));
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught, t));
    } finally {
      setBusy(null);
    }
  };

  const changeMode = async (next: Mode) => {
    const previous = mode;
    setMode(next);
    setBusy("autopilot");
    setError(null);
    try {
      await api.post(`/api/sites/${site.id}/autopilot`, { mode: next });
      toast.success(next === "MANUAL" ? t("schedule.disabled") : t("schedule.enabled"));
      router.refresh();
    } catch (caught) {
      setMode(previous);
      setError(errorMessage(caught, t));
    } finally {
      setBusy(null);
    }
  };

  const createTask = async () => {
    setBusy("task");
    setError(null);
    try {
      const input: Record<string, unknown> = {};
      if (taskType === "GENERATE_ARTICLE" && taskTitle.trim()) input.title = taskTitle.trim();
      if (taskType === "RESEARCH_TOPIC" && taskTitle.trim()) input.topic = taskTitle.trim();
      await api.post(`/api/sites/${site.id}/tasks`, { type: taskType, input, runNow: true });
      toast.success(t("schedule.taskCreated"));
      setNewTaskOpen(false);
      setTaskTitle("");
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught, t));
    } finally {
      setBusy(null);
    }
  };

  const modeOptions: Array<{ value: Mode; title: string; body: string }> = [
    { value: "MANUAL", title: t("onboarding.manual"), body: t("onboarding.manualDesc") },
    { value: "REVIEW", title: t("onboarding.review"), body: t("onboarding.reviewDesc") },
    { value: "FULL", title: t("onboarding.full"), body: t("onboarding.fullDesc") },
  ];

  return (
    <div className="space-y-4">
      {error ? (
        <Alert
          tone="danger"
          role="alert"
          actions={
            <Button size="sm" onClick={() => setError(null)}>
              {t("common.close")}
            </Button>
          }
        >
          {error}
        </Alert>
      ) : null}

      <Card>
        <CardHeader
          title={
            <span className="inline-flex items-center gap-2">
              <Zap className="h-4 w-4 text-accent" aria-hidden="true" />
              {t("schedule.autopilot")}
            </span>
          }
          description={t("schedule.autopilotHelp")}
        />
        <CardBody className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {modeOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={mode === option.value}
              disabled={busy === "autopilot"}
              onClick={() => changeMode(option.value)}
              className={`card-flat p-4 text-start transition disabled:opacity-60 ${
                mode === option.value ? "border-accent bg-accent-soft" : "hover:border-line-strong"
              }`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">{option.title}</span>
                {mode === option.value ? <Check className="h-4 w-4 text-accent" aria-hidden="true" /> : null}
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-muted">{option.body}</span>
            </button>
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={
            <span className="inline-flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-accent" aria-hidden="true" />
              {t("schedule.frequency")}
            </span>
          }
          description={t("schedule.frequencyHelp")}
          actions={
            <Button
              size="sm"
              variant="primary"
              loading={busy === "schedule"}
              onClick={saveSchedule}
              icon={<Check className="h-4 w-4" />}
            >
              {busy === "schedule" ? t("common.saving") : t("common.save")}
            </Button>
          }
        />
        <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label={t("schedule.frequency")}>
            {({ id }) => (
              <Select id={id} value={frequency} onChange={(event) => setFrequency(event.target.value)}>
                {FREQUENCIES.map((option) => (
                  <option key={option} value={option}>
                    {t(`schedule.frequencies.${option}`)}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label={t("schedule.publishHour")}>
            {({ id }) => (
              <Input
                id={id}
                type="number"
                min={0}
                max={23}
                value={publishHour}
                onChange={(event) => setPublishHour(Number(event.target.value))}
              />
            )}
          </Field>

          <Field label={t("schedule.timezone")}>
            {({ id }) => (
              <Input id={id} value={timezone} onChange={(event) => setTimezone(event.target.value)} />
            )}
          </Field>

          <div className="sm:col-span-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="surface-2 flex items-center gap-3 p-3">
              <Clock className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-faint">
                  {t("schedule.nextRun")}
                </p>
                <p className="truncate text-sm">
                  {schedule?.nextRunAt ? (
                    <span suppressHydrationWarning>
                      {formatDateTime(schedule.nextRunAt)} ({formatRelativeTime(schedule.nextRunAt)})
                    </span>
                  ) : (
                    t("common.never")
                  )}
                </p>
              </div>
            </div>
            <div className="surface-2 flex items-center gap-3 p-3">
              <RefreshCw className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-faint">
                  {t("schedule.lastRun")}
                </p>
                <p className="truncate text-sm">{t("schedule.autoloop")}</p>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={t("schedule.tasks")}
          actions={
            <Button size="sm" onClick={() => setNewTaskOpen(true)} icon={<Plus className="h-4 w-4" />}>
              {t("schedule.newTask")}
            </Button>
          }
        />
        <CardBody>
          {tasks.length === 0 ? (
            <EmptyState title={t("schedule.tasks")} body={t("schedule.tasksEmpty")} />
          ) : (
            <ul className="space-y-2">
              {tasks.map((task) => (
                <li key={task.id} className="surface-2 flex flex-wrap items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{t(`activity.type.${task.type}`)}</p>
                    <p className="truncate text-xs text-muted">
                      <span suppressHydrationWarning>
                        {formatRelativeTime(task.scheduledAt)}
                      </span>
                      {task.error ? ` · ${task.error}` : ""}
                    </p>
                  </div>
                  <StatusBadge status={task.status} label={t(`schedule.taskStatus.${task.status}`)} />
                  <Link href={`/activity?site=${site.id}`} className="link text-xs">
                    {t("nav.activity")}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-faint">{t("schedule.autoloop")}</p>
          <div className="mt-1">
            <Badge tone={mode === "MANUAL" ? "neutral" : "success"}>
              {t(`sites.autopilot.${mode}`)}
            </Badge>
          </div>
        </CardBody>
      </Card>

      <Dialog
        open={newTaskOpen}
        onClose={() => setNewTaskOpen(false)}
        title={t("schedule.newTask")}
        description={t("schedule.autoloop")}
        footer={
          <>
            <Button onClick={() => setNewTaskOpen(false)}>{t("common.cancel")}</Button>
            <Button
              variant="primary"
              loading={busy === "task"}
              onClick={createTask}
              disabled={
                (taskType === "GENERATE_ARTICLE" || taskType === "RESEARCH_TOPIC") &&
                taskTitle.trim().length === 0
              }
            >
              {t("schedule.runNow")}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label={t("schedule.taskTypes.GENERATE_ARTICLE")}>
            {({ id }) => (
              <Select id={id} value={taskType} onChange={(event) => setTaskType(event.target.value)}>
                {["GENERATE_ARTICLE", "RESEARCH_TOPIC", "SEO_AUDIT", "ANALYZE_SITE", "GENERATE_CONTENT_PLAN", "GENERATE_PAGES"].map(
                  (option) => (
                    <option key={option} value={option}>
                      {t(`schedule.taskTypes.${option}`)}
                    </option>
                  ),
                )}
              </Select>
            )}
          </Field>
          <Field label={t("editor.title")} optionalLabel={t("common.optional")}>
            {({ id }) => (
              <Input id={id} value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} />
            )}
          </Field>
        </div>
      </Dialog>
    </div>
  );
}
