"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ThemePreference = "light" | "dark" | "system";

type ThemeContextValue = {
  theme: ThemePreference;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const THEME_COOKIE = "sitepilot_theme";
export const THEME_STORAGE_KEY = "sitepilot_theme";

function systemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function apply(theme: ThemePreference) {
  const dark = theme === "dark" || (theme === "system" && systemTheme() === "dark");
  document.documentElement.classList.toggle("dark", dark);
}

export function ThemeProvider({
  initialTheme,
  children,
}: {
  initialTheme?: string;
  children: ReactNode;
}) {
  const [theme, setThemeState] = useState<ThemePreference>(() =>
    initialTheme === "light" || initialTheme === "dark" || initialTheme === "system"
      ? initialTheme
      : "system",
  );
  const [resolved, setResolved] = useState<"light" | "dark">("light");

  useEffect(() => {
    apply(theme);
    setResolved(document.documentElement.classList.contains("dark") ? "dark" : "light");
  }, [theme]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (theme === "system") {
        apply("system");
        setResolved(document.documentElement.classList.contains("dark") ? "dark" : "light");
      }
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((next: ThemePreference) => {
    setThemeState(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* storage unavailable */
    }
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    apply(next);
    setResolved(document.documentElement.classList.contains("dark") ? "dark" : "light");
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, resolvedTheme: resolved, setTheme }),
    [theme, resolved, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
