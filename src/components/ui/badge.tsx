import type { ReactNode } from "react";

export type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger";

const TONE_CLASS: Record<BadgeTone, string> = {
  neutral: "",
  accent: "badge-accent",
  success: "badge-success",
  warning: "badge-warning",
  danger: "badge-danger",
};

export function Badge({
  tone = "neutral",
  children,
  className = "",
  ...rest
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
} & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={`badge ${TONE_CLASS[tone]} ${className}`} {...rest}>
      {children}
    </span>
  );
}

/** Maps Prisma enums to a tone so status colours stay consistent. */
export function statusTone(status: string): BadgeTone {
  switch (status) {
    case "LIVE":
    case "PUBLISHED":
    case "COMPLETED":
    case "APPROVED":
    case "SUCCESS":
      return "success";
    case "BUILDING":
    case "RUNNING":
    case "REVIEW":
    case "QUEUED":
      return "accent";
    case "PAUSED":
    case "DRAFT":
      return "neutral";
    case "FAILED":
    case "ARCHIVED":
    case "CANCELLED":
      return "danger";
    default:
      return "neutral";
  }
}

export function StatusBadge({ status, label }: { status: string; label: string }) {
  return <Badge tone={statusTone(status)}>{label}</Badge>;
}
