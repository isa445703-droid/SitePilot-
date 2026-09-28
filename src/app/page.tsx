import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  FileText,
  Gauge,
  Layers,
  Radio,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { getServerI18n } from "@/lib/i18n/server";
import { LanguageSwitcher, ThemeSwitcher } from "@/components/layout/app-shell";
import { LinkButton } from "@/components/ui/button";

export default async function LandingPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  const { t } = await getServerI18n();
  const year = new Date().getFullYear();

  const features = [
    { icon: Layers, title: t("landing.features.f1Title"), body: t("landing.features.f1Desc") },
    { icon: CalendarClock, title: t("landing.features.f2Title"), body: t("landing.features.f2Desc") },
    { icon: Radio, title: t("landing.features.f3Title"), body: t("landing.features.f3Desc") },
    { icon: ShieldCheck, title: t("landing.features.f4Title"), body: t("landing.features.f4Desc") },
    { icon: Gauge, title: t("landing.features.f5Title"), body: t("landing.features.f5Desc") },
    { icon: FileText, title: t("landing.features.f6Title"), body: t("landing.features.f6Desc") },
  ];

  const steps = [
    { n: 1, title: t("landing.steps.s1Title"), body: t("landing.steps.s1Desc") },
    { n: 2, title: t("landing.steps.s2Title"), body: t("landing.steps.s2Desc") },
    { n: 3, title: t("landing.steps.s3Title"), body: t("landing.steps.s3Desc") },
    { n: 4, title: t("landing.steps.s4Title"), body: t("landing.steps.s4Desc") },
  ];

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-accent text-sm font-black text-white">
              SP
            </span>
            <span className="text-[15px] font-bold tracking-tight">{t("app.name")}</span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeSwitcher />
            <LanguageSwitcher />
            <LinkButton href="/login" variant="ghost" size="sm">
              {t("common.signIn")}
            </LinkButton>
            <LinkButton href="/signup" variant="primary" size="sm">
              {t("common.signUp")}
            </LinkButton>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(60%_60%_at_50%_0%,color-mix(in_oklab,var(--sp-accent)_16%,transparent),transparent)]"
            aria-hidden="true"
          />
          <div className="mx-auto w-full max-w-6xl px-4 py-16 text-center sm:px-6 sm:py-24">
            <span className="badge badge-accent mb-5 inline-flex">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              {t("landing.hero.badge")}
            </span>
            <h1 className="mx-auto max-w-3xl text-4xl font-extrabold leading-[1.05] tracking-tighter sm:text-6xl">
              {t("landing.hero.title")}
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-balance text-base text-muted sm:text-lg">
              {t("landing.hero.subtitle")}
            </p>
            <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
              <LinkButton href="/signup" variant="primary" size="lg">
                {t("landing.hero.ctaPrimary")}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </LinkButton>
              <LinkButton href="#how" variant="secondary" size="lg">
                {t("landing.hero.ctaSecondary")}
              </LinkButton>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <div className="mx-auto mb-8 max-w-2xl text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {t("landing.features.title")}
            </h2>
            <p className="mt-2 text-muted">{t("landing.features.subtitle")}</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <article key={feature.title} className="card p-5">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent">
                  <feature.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="mt-3 text-base font-semibold">{feature.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{feature.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Steps */}
        <section id="how" className="border-y border-line bg-surface">
          <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
            <h2 className="mb-8 text-center text-2xl font-bold tracking-tight sm:text-3xl">
              {t("landing.steps.title")}
            </h2>
            <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {steps.map((step) => (
                <li key={step.n} className="card-flat p-5">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-sm font-bold text-white">
                    {step.n}
                  </span>
                  <h3 className="mt-3 text-base font-semibold">{step.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <div className="card relative overflow-hidden p-8 text-center sm:p-12">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {t("landing.cta.title")}
            </h2>
            <div className="mt-6 flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center">
              <LinkButton href="/signup" variant="primary" size="lg">
                {t("landing.cta.cta")}
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              </LinkButton>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-muted sm:flex-row sm:px-6">
          <p>{t("landing.footer.product")}</p>
          <p>{t("landing.footer.rights", { year })}</p>
        </div>
      </footer>
    </div>
  );
}
