import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n/provider";
import { LOCALE_DIRS, resolveLocale } from "@/lib/i18n/config";
import { ThemeProvider } from "@/components/theme/theme-provider";

export const metadata: Metadata = {
  title: {
    default: "SitePilot — Describe your website. AI runs it.",
    template: "%s · SitePilot",
  },
  description:
    "SitePilot is an AI website operating system: describe the site you want, review the blueprint, and let AI research, write, publish and maintain it on autopilot.",
  applicationName: "SitePilot",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f8fa" },
    { media: "(prefers-color-scheme: dark)", color: "#070b14" },
  ],
};

/**
 * Applies the persisted theme before first paint (no flash) and marks the
 * document language/direction for the selected UI locale.
 */
const themeInit = `(function(){try{
  var t=localStorage.getItem('sitepilot_theme')||'system';
  var dark=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark',dark);
}catch(e){}})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const store = await cookies();
  const locale = resolveLocale(store.get("sitepilot_locale")?.value);
  const theme = store.get("sitepilot_theme")?.value;
  const dir = LOCALE_DIRS[locale];

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>
        <ThemeProvider initialTheme={theme}>
          <I18nProvider initialLocale={locale}>{children}</I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
