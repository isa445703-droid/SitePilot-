"use client";

import { useCallback, useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useT } from "@/lib/i18n/provider";

/**
 * Modal dialog: focus trap, Escape to close, scroll lock, rendered in a portal
 * so it always fits the viewport (max-height + internal scroll).
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const t = useT();
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  const close = useCallback(() => onClose(), [onClose]);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>(
      "input, select, textarea, button, [href], [tabindex]:not([tabindex='-1'])",
    );
    (first ?? panel)?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        close();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const focusables = Array.from(
        panel.querySelectorAll<HTMLElement>(
          "a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex='-1'])",
        ),
      );
      if (focusables.length === 0) return;
      const firstEl = focusables[0];
      const lastEl = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === firstEl) {
        event.preventDefault();
        lastEl.focus();
      } else if (!event.shiftKey && document.activeElement === lastEl) {
        event.preventDefault();
        firstEl.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      restoreRef.current?.focus?.();
    };
  }, [open, close]);

  if (!open) return null;

  const widthClass =
    size === "sm" ? "max-w-sm" : size === "lg" ? "max-w-3xl" : "max-w-xl";

  const panel = (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px] animate-in-fade"
        onClick={close}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={`card relative z-10 flex max-h-[92dvh] w-full flex-col animate-in-up sm:rounded-2xl ${widthClass}`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-5">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-semibold">
              {title}
            </h2>
            {description ? (
              <p id={descId} className="mt-1 text-sm text-muted">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={close}
            className="btn btn-ghost -me-1 !p-2"
            aria-label={t("common.close")}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin px-4 py-4 sm:px-5">
          {children}
        </div>
        {footer ? (
          <div className="flex flex-col-reverse gap-2 border-t border-line px-4 py-3.5 sm:flex-row sm:justify-end sm:px-5">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(panel, document.body);
}
