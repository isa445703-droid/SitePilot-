import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
  flat = false,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  flat?: boolean;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`${flat ? "card-flat" : "card"} ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function CardBody({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`p-4 sm:p-5 ${className}`}>{children}</div>;
}

export function CardHeader({
  title,
  description,
  actions,
  level = 2,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  level?: 1 | 2 | 3;
}) {
  const Tag = (`h${level}` as unknown) as "h2";
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 p-4 sm:p-5 pb-0">
      <div className="min-w-0">
        <Tag className="text-base font-semibold">{title}</Tag>
        {description ? (
          <p className="mt-1 text-sm text-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-bold sm:text-2xl">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function Section({
  title,
  description,
  actions,
  children,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mb-6">
      {title ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-faint">{title}</h2>
            {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
          </div>
          {actions}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "neutral",
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: "neutral" | "accent" | "success" | "warning" | "danger";
}) {
  const toneClass = {
    neutral: "",
    accent: "text-accent",
    success: "text-success",
    warning: "text-warning",
    danger: "text-danger",
  }[tone];

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium uppercase tracking-wide text-faint">{label}</p>
          <p className={`mt-1.5 text-2xl font-bold tabular ${toneClass}`}>{value}</p>
          {hint ? <p className="mt-1 truncate text-xs text-muted">{hint}</p> : null}
        </div>
        {icon ? (
          <span
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-2 ${toneClass}`}
            aria-hidden="true"
          >
            {icon}
          </span>
        ) : null}
      </div>
    </Card>
  );
}

export function KeyValues({ items }: { items: Array<{ label: ReactNode; value: ReactNode }> }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map((item, index) => (
        <div key={index} className="min-w-0">
          <dt className="text-xs font-medium uppercase tracking-wide text-faint">{item.label}</dt>
          <dd className="mt-0.5 break-words text-sm">{item.value || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
