import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

type FieldShellProps = {
  id?: string;
  label?: ReactNode;
  help?: ReactNode;
  error?: ReactNode;
  optionalLabel?: string;
  children: (ids: { id: string; describedBy: string | undefined }) => ReactNode;
};

/** Accessible label + control + help/error wrapper. */
export function Field({ id, label, help, error, optionalLabel, children }: FieldShellProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const helpId = `${fieldId}-help`;
  const errorId = `${fieldId}-error`;
  const describedBy =
    [help ? helpId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div>
      {label ? (
        <label className="label" htmlFor={fieldId}>
          {label}
          {optionalLabel ? (
            <span className="ms-1 font-normal text-faint">({optionalLabel})</span>
          ) : null}
        </label>
      ) : null}
      {children({ id: fieldId, describedBy })}
      {error ? (
        <p className="error-text" id={errorId} role="alert">
          {error}
        </p>
      ) : help ? (
        <p className="help" id={helpId}>
          {help}
        </p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }
>(function Input({ className = "", invalid, ...rest }, ref) {
  return (
    <input
      ref={ref}
      className={`input ${className}`}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(function Textarea({ className = "", invalid, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      className={`textarea ${className}`}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className = "", children, ...rest }, ref) {
    return (
      <select ref={ref} className={`select ${className}`} {...rest}>
        {children}
      </select>
    );
  },
);

/** Colour swatch input paired with a hex text field. */
export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const fieldId = useId();
  return (
    <div>
      <label className="label" htmlFor={fieldId}>
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-line bg-surface p-1"
        />
        <input
          id={fieldId}
          className="input tabular"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          maxLength={7}
        />
      </div>
    </div>
  );
}
