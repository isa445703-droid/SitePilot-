import type { ReactNode } from "react";
import { AlertCircle, Inbox, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Spinner({ label, className = "" }: { label?: string; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 text-sm text-muted ${className}`}>
      <span className="spinner" aria-hidden="true" />
      {label}
    </span>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <span
      className={`block animate-in-fade rounded-lg bg-surface-2 ${className}`}
      aria-hidden="true"
    />
  );
}

export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="card-flat flex items-center gap-3 p-4">
          <Skeleton className="h-9 w-9 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function LoadingState({ label }: { label: string }) {
  return (
    <div
      className="card-flat grid place-items-center gap-3 p-10 text-center"
      role="status"
      aria-live="polite"
    >
      <span className="spinner h-5 w-5 text-accent" aria-hidden="true" />
      <p className="text-sm text-muted">{label}</p>
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
  icon,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="card-flat grid place-items-center gap-2 p-8 text-center sm:p-10">
      <span
        className="grid h-11 w-11 place-items-center rounded-2xl bg-surface-2 text-faint"
        aria-hidden="true"
      >
        {icon ?? <Inbox className="h-5 w-5" />}
      </span>
      <h3 className="text-base font-semibold">{title}</h3>
      {body ? <p className="max-w-md text-sm text-muted">{body}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title,
  body,
  onRetry,
  retryLabel,
}: {
  title: string;
  body?: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <div
      className="card-flat grid place-items-center gap-2 border-danger/30 bg-danger-soft p-8 text-center sm:p-10"
      role="alert"
    >
      <span className="grid h-11 w-11 place-items-center rounded-2xl bg-surface text-danger" aria-hidden="true">
        <AlertCircle className="h-5 w-5" />
      </span>
      <h3 className="text-base font-semibold">{title}</h3>
      {body ? <p className="max-w-md text-sm text-muted">{body}</p> : null}
      {onRetry ? (
        <div className="mt-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={onRetry}
            icon={<RefreshCw className="h-4 w-4" />}
          >
            {retryLabel ?? "Retry"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
