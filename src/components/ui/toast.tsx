"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";

type Tone = "success" | "error" | "info";

type ToastItem = { id: number; message: string; tone: Tone };

type ToastContextValue = {
  push: (message: string, tone?: Tone) => void;
  success: (message: string) => void;
  error: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_STYLE: Record<Tone, { className: string; Icon: typeof Info }> = {
  success: { className: "border-success/30 bg-success-soft text-success", Icon: CheckCircle2 },
  error: { className: "border-danger/30 bg-danger-soft text-danger", Icon: XCircle },
  info: { className: "border-line bg-surface text-ink shadow-lg", Icon: Info },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const remove = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const push = useCallback(
    (message: string, tone: Tone = "info") => {
      counter.current += 1;
      const id = counter.current;
      setItems((current) => [...current.slice(-3), { id, message, tone }]);
      window.setTimeout(() => remove(id), tone === "error" ? 7000 : 4000);
    },
    [remove],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      push,
      success: (message: string) => push(message, "success"),
      error: (message: string) => push(message, "error"),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-3 sm:inset-x-auto sm:end-4 sm:bottom-4 sm:items-end"
        role="region"
        aria-live="polite"
      >
        {items.map((item) => (
          <ToastCard key={item.id} item={item} onDismiss={() => remove(item.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const { className, Icon } = TONE_STYLE[item.tone];
  useEffect(() => () => undefined, []);
  return (
    <div
      className={`pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm animate-in-up ${className}`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1 break-words">{item.message}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="-me-1 rounded-md p-1 opacity-60 hover:opacity-100"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
