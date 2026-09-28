"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/provider";
import { api, errorMessage } from "@/lib/api/client";
import { useToast } from "@/components/ui/toast";

type Mode = "MANUAL" | "REVIEW" | "FULL";

const MODES: Mode[] = ["MANUAL", "REVIEW", "FULL"];

/** Compact three-way autopilot switch used in lists. */
export function AutopilotSwitch({ siteId, value }: { siteId: string; value: string }) {
  const t = useT();
  const router = useRouter();
  const toast = useToast();
  const [mode, setMode] = useState<Mode>(value as Mode);
  const [busy, setBusy] = useState(false);

  const change = async (next: Mode) => {
    if (next === mode) return;
    const previous = mode;
    setMode(next);
    setBusy(true);
    try {
      await api.post(`/api/sites/${siteId}/autopilot`, { mode: next });
      toast.success(next === "MANUAL" ? t("schedule.disabled") : t("schedule.enabled"));
      router.refresh();
    } catch (error) {
      setMode(previous);
      toast.error(errorMessage(error, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="inline-flex rounded-xl border border-line bg-surface p-0.5"
      role="group"
      aria-label={t("schedule.autopilot")}
    >
      {MODES.map((item) => (
        <button
          key={item}
          type="button"
          disabled={busy}
          aria-pressed={mode === item}
          onClick={() => change(item)}
          className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition disabled:opacity-60 ${
            mode === item ? "bg-accent text-white" : "text-muted hover:bg-surface-2 hover:text-ink"
          }`}
          title={t(`sites.autopilot.${item}`)}
        >
          {t(`sites.autopilot.${item}`)}
          <span className="sr-only">{t(`sites.autopilot.${item}`)}</span>
        </button>
      ))}
    </div>
  );
}
