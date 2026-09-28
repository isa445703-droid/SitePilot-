"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Activity,
  BarChart3,
  CalendarClock,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Monitor,
  Plus,
  Settings,
  Globe,
  Sun,
  X,
  type LucideIcon,
} from "lucide-react";
import { useI18n, useT, LOCALE_COOKIE } from "@/lib/i18n/provider";
import { LOCALES, LOCALE_LABELS } from "@/lib/i18n/config";
import { useTheme } from "@/components/theme/theme-provider";
import { api } from "@/lib/api/client";

export type SessionInfo = {
  id: string;
  email: string;
  name: string | null;
  locale: string;
  theme: string;
} | null;

type NavItem = { href: string; label: string; Icon: LucideIcon; exact?: boolean };

function useNavItems(): NavItem[] {
  const t = useT();
  return useMemo(
    () => [
      { href: "/dashboard", label: t("nav.dashboard"), Icon: LayoutDashboard, exact: true },
      { href: "/sites", label: t("nav.sites"), Icon: Globe },
      { href: "/content", label: t("nav.content"), Icon: FileText },
      { href: "/schedule", label: t("nav.schedule"), Icon: CalendarClock },
      { href: "/activity", label: t("nav.activity"), Icon: Activity },
      { href: "/analytics", label: t("nav.analytics"), Icon: BarChart3 },
      { href: "/settings", label: t("nav.settings"), Icon: Settings },
    ],
    [t],
  );
}

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale } = useI18n();
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className={compact ? "btn btn-ghost btn-sm" : "btn btn-secondary btn-sm"}
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("common.language")}
      >
        <Globe className="h-4 w-4" aria-hidden="true" />
        <span className="hidden sm:inline">{LOCALE_LABELS[locale]}</span>
        <span className="sm:hidden">{locale.toUpperCase()}</span>
      </button>
      {open ? (
        <div
          role="menu"
          className="card absolute end-0 z-40 mt-2 w-44 overflow-hidden p-1 animate-in-scale"
        >
          {LOCALES.map((item) => (
            <button
              key={item}
              type="button"
              role="menuitemradio"
              aria-checked={item === locale}
              className="nav-item w-full justify-between"
              onClick={() => {
                void setLocale(item);
                document.cookie = `${LOCALE_COOKIE}=${item}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
                setOpen(false);
              }}
            >
              {LOCALE_LABELS[item]}
              {item === locale ? <span aria-hidden="true">✓</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ThemeSwitcher() {
  const t = useT();
  const { theme, setTheme } = useTheme();
  const options: Array<{ value: "light" | "dark" | "system"; Icon: LucideIcon }> = [
    { value: "light", Icon: Sun },
    { value: "dark", Icon: Moon },
    { value: "system", Icon: Monitor },
  ];
  const active = options.find((option) => option.value === theme) ?? options[2];

  return (
    <div
      className="flex items-center rounded-xl border border-line bg-surface p-0.5"
      role="group"
      aria-label={t("settings.theme")}
    >
      {options.map(({ value, Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => setTheme(value)}
          aria-pressed={theme === value}
          title={t(`settings.themes.${value}`)}
          className={`rounded-lg p-1.5 transition ${
            theme === value
              ? "bg-accent-soft text-accent"
              : "text-muted hover:bg-surface-2 hover:text-ink"
          }`}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">{t(`settings.themes.${value}`)}</span>
        </button>
      ))}
      <span className="sr-only">{active.value}</span>
    </div>
  );
}

export function AppShell({
  user,
  children,
  siteName,
}: {
  user: NonNullable<SessionInfo>;
  children: React.ReactNode;
  siteName?: string;
}) {
  const t = useT();
  const pathname = usePathname();
  const router = useRouter();
  const items = useNavItems();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  const signOut = useCallback(async () => {
    try {
      await api.post("/api/auth/logout");
    } finally {
      router.push("/login");
      router.refresh();
    }
  }, [router]);

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  const nav = (
    <nav aria-label={t("nav.mainNavigation")} className="flex flex-col gap-1">
      <Link href="/dashboard" className="mb-4 flex items-center gap-2.5 px-2 pt-1">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-accent text-sm font-black text-white">
          SP
        </span>
        <span className="text-[15px] font-bold tracking-tight">{t("app.name")}</span>
      </Link>

      <Link href="/sites/new" className="btn btn-primary btn-sm mb-3 w-full">
        <Plus className="h-4 w-4" aria-hidden="true" />
        {t("dashboard.newSite")}
      </Link>

      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`nav-item ${isActive(item) ? "nav-item-active" : ""}`}
          aria-current={isActive(item) ? "page" : undefined}
        >
          <item.Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
          <span className="truncate">{item.label}</span>
        </Link>
      ))}
    </nav>
  );

  return (
    <div className="min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 start-0 z-30 hidden w-64 flex-col border-e border-line bg-surface p-4 lg:flex">
        {nav}
        <div className="mt-auto border-t border-line pt-3">
          <div className="mb-2 px-2 text-xs font-medium text-faint">{user.email}</div>
          <button type="button" className="nav-item w-full" onClick={signOut}>
            <LogOut className="h-[18px] w-[18px]" aria-hidden="true" />
            {t("common.signOut")}
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-950/45 animate-in-fade"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <div
            className="absolute inset-y-0 start-0 flex w-[82%] max-w-xs flex-col overflow-y-auto bg-surface p-4 animate-in-up"
            role="dialog"
            aria-modal="true"
            aria-label={t("nav.mainNavigation")}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold">{t("app.name")}</span>
              <button
                type="button"
                className="btn btn-ghost !p-2"
                onClick={() => setDrawerOpen(false)}
                aria-label={t("nav.closeMenu")}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            {nav}
            <div className="mt-auto border-t border-line pt-3">
              <div className="mb-2 px-2 text-xs font-medium text-faint">{user.email}</div>
              <button type="button" className="nav-item w-full" onClick={signOut}>
                <LogOut className="h-[18px] w-[18px]" aria-hidden="true" />
                {t("common.signOut")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Content column */}
      <div className="lg:ps-64">
        <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-line bg-surface/85 px-3 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-surface/70 sm:px-5">
          <button
            type="button"
            className="btn btn-ghost !p-2 lg:hidden"
            onClick={() => setDrawerOpen(true)}
            aria-label={t("nav.openMenu")}
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
          <div className="min-w-0 flex-1 truncate text-sm font-medium text-muted">
            {siteName ?? user.name ?? user.email}
          </div>
          <ThemeSwitcher />
          <LanguageSwitcher compact />
        </header>
        <main className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-5 sm:py-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
