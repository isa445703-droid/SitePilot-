import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";

export type AlertTone = "info" | "success" | "warning" | "danger";

const CONFIG: Record<
  AlertTone,
  { className: string; Icon: typeof Info }
> = {
  info: { className: "bg-accent-soft text-accent border-accent/30", Icon: Info },
  success: { className: "bg-success-soft text-success border-success/30", Icon: CheckCircle2 },
  warning: { className: "bg-warning-soft text-warning border-warning/30", Icon: AlertTriangle },
  danger: { className: "bg-danger-soft text-danger border-danger/30", Icon: XCircle },
};

export function Alert({
  tone = "info",
  title,
  children,
  actions,
  className = "",
  role = "status",
}: {
  tone?: AlertTone;
  title?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
  role?: "status" | "alert";
}) {
  const { className: toneClass, Icon } = CONFIG[tone];
  return (
    <div
      className={`flex items-start gap-3 rounded-xl border p-3.5 text-sm ${toneClass} ${className}`}
      role={role}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={title ? "mt-0.5 opacity-90" : ""}>{children}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
