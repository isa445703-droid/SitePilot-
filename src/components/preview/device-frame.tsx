"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Monitor, Smartphone, Tablet } from "lucide-react";
import { useT } from "@/lib/i18n/provider";

type Device = "desktop" | "tablet" | "mobile";

const WIDTH: Record<Device, string> = {
  desktop: "100%",
  tablet: "768px",
  mobile: "390px",
};

/**
 * Preview shell: a toolbar with device widths (320–1440 coverage is done by
 * real responsive CSS inside the site) plus navigation back into the app.
 */
export function DeviceFrame({ siteId, children }: { siteId: string; children: ReactNode }) {
  const t = useT();
  const [device, setDevice] = useState<Device>("desktop");

  const devices: Array<{ value: Device; Icon: typeof Monitor; label: string }> = [
    { value: "desktop", Icon: Monitor, label: t("preview.deviceDesktop") },
    { value: "tablet", Icon: Tablet, label: t("preview.deviceTablet") },
    { value: "mobile", Icon: Smartphone, label: t("preview.deviceMobile") },
  ];

  return (
    <div className="min-h-dvh bg-surface-2">
      <div className="sticky top-0 z-40 border-b border-line bg-surface/95 px-3 py-2.5 backdrop-blur sm:px-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Link
              href={`/sites/${siteId}`}
              className="btn btn-ghost btn-sm"
              aria-label={t("preview.backToApp")}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">{t("preview.backToApp")}</span>
            </Link>
            <span className="badge badge-accent">
              {t("preview.badge")}
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </span>
          </div>

          <div
            className="flex items-center rounded-xl border border-line bg-surface p-0.5"
            role="group"
            aria-label={t("preview.badge")}
          >
            {devices.map(({ value, Icon, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setDevice(value)}
                aria-pressed={device === value}
                title={label}
                className={`rounded-lg p-1.5 transition ${
                  device === value
                    ? "bg-accent-soft text-accent"
                    : "text-muted hover:bg-surface-2 hover:text-ink"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto w-full px-0 py-0 sm:px-4 sm:py-4" style={{ maxWidth: WIDTH[device] === "100%" ? undefined : WIDTH[device] }}>
        <div className="overflow-hidden border-0 sm:rounded-2xl sm:border sm:border-line sm:shadow-lg">
          {children}
        </div>
      </div>
    </div>
  );
}
