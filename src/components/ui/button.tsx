import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  block?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
};

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  ghost: "btn-ghost",
  danger: "btn-danger",
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: "btn-sm",
  md: "",
  lg: "btn-lg",
};

/**
 * Button — always a real <button> (keyboard accessible by definition).
 * Never wrap a clickable div in this design system.
 */
export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  {
    variant = "secondary",
    size = "md",
    loading = false,
    block = false,
    icon,
    iconRight,
    className = "",
    children,
    disabled,
    type = "button",
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={[
        "btn",
        VARIANT_CLASS[variant],
        SIZE_CLASS[size],
        block ? "btn-block" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <span className="spinner" aria-hidden="true" /> : icon}
      {children}
      {!loading && iconRight}
    </button>
  );
});

/** Icon-only button with an accessible label. */
export const IconButton = forwardRef<HTMLButtonElement, Props>(function IconButton(
  { className = "", children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      className={`btn btn-ghost !p-2 rounded-xl ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
});

/** Renders an anchor styled as a button (navigation, not action). */
export function LinkButton({
  href,
  variant = "secondary",
  size = "md",
  className = "",
  block = false,
  icon,
  iconRight,
  children,
  ...rest
}: {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  block?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
  children: ReactNode;
} & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      href={href}
      className={["btn", VARIANT_CLASS[variant], SIZE_CLASS[size], block ? "btn-block" : "", className]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {icon}
      {children}
      {iconRight}
    </a>
  );
}
