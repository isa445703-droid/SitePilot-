import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getServerI18n } from "@/lib/i18n/server";
import { LinkButton } from "@/components/ui/button";
import { PlanCta } from "@/components/pricing/plan-cta";

export default async function PricingPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  const { t } = await getServerI18n();
  const year = new Date().getFullYear();

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-accent text-sm font-black text-white">SP</span>
            <span className="text-[15px] font-bold tracking-tight">{t("app.name")}</span>
          </Link>
          <div className="flex items-center gap-2">
            <LinkButton href="/login" variant="ghost" size="sm">
              {t("common.signIn")}
            </LinkButton>
          </div>
        </div>
      </header>

      <main className="px-4 py-12 sm:px-6">
        <div className="mx-auto w-full max-w-3xl px-4 text-center">
          <h1 className="mx-auto max-w-2xl text-4xl font-extrabold leading-[1.05] tracking-tighter sm:text-6xl mb-6">
            {t("pricing.title")}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-balance text-lg text-muted mb-12">
            {t("pricing.subtitle")}
          </p>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {/* Free Tier */}
            <div className="surface-2 rounded-2xl p-8 border border-line/50">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-muted/10 text-muted mb-4">
                <span className="text-3xl">🆓</span>
              </div>
              <h3 className="text-xl font-bold text-ink mb-2">{t("pricing.freePlan")}</h3>
              <p className="text-muted text-sm mb-6">{t("pricing.freeDesc")}</p>
              <ul className="space-y-2 text-sm text-muted">
                <li>✅ 1 site</li>
                <li>✅ Basic blueprint generation</li>
                <li>✅ 3 articles per month</li>
                <li>✅ Email support</li>
                <li>❌ Autopilot publishing</li>
                <li>❌ Custom domain</li>
                <li>❌ SEO analytics</li>
              </ul>
              <LinkButton href="/signup" variant="secondary" size="lg" className="mt-4 w-full">
                {t("pricing.startFree")}
              </LinkButton>
            </div>

            {/* Starter Tier */}
            <div className="surface-2 rounded-2xl p-8 border border-line/50">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-accent text-white mb-4">
                <span className="text-3xl">🪪</span>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">{t("pricing.starterPlan")}</h3>
              <p className="text-muted text-sm mb-6">{t("pricing.starterDesc")}</p>
              <ul className="space-y-2 text-sm text-muted">
                <li>✅ Unlimited sites</li>
                <li>✅ Full blueprint generation</li>
                <li>✅ 50 articles per month</li>
                <li>✅ Autopilot publishing (MANUAL)</li>
                <li>✅ Custom domain</li>
                <li>✅ SEO analytics</li>
                <li>✅ Email support</li>
              </ul>
              <PlanCta plan="starter" variant="secondary">
                {t("pricing.startStarter")}
              </PlanCta>
            </div>

            {/* Pro Tier */}
            <div className="surface-2 rounded-2xl p-8 border border-line/50 bg-accent/10">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-accent text-white mb-4">
                <span className="text-3xl">👑</span>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">{t("pricing.proPlan")}</h3>
              <p className="text-muted text-sm mb-6">{t("pricing.proDesc")}</p>
              <ul className="space-y-2 text-sm text-muted">
                <li>✅ Unlimited sites</li>
                <li>✅ Full blueprint generation</li>
                <li>✅ Unlimited articles per month</li>
                <li>✅ Autopilot publishing (FULL)</li>
                <li>✅ Custom domain</li>
                <li>✅ Advanced SEO analytics</li>
                <li>✅ Priority email support</li>
                <li>✅ API access</li>
              </ul>
              <PlanCta plan="pro" variant="primary">
                {t("pricing.startPro")}
              </PlanCta>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-line pt-6 mt-12">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-muted sm:flex-row">
          <p>{t("landing.footer.product")}</p>
          <p>{t("landing.footer.rights", { year })}</p>
          <div className="flex gap-4">
            <Link href="/legal/terms" className="text-primary hover:underline">
              {t("landing.footer.terms")}
            </Link>
            <Link href="/legal/privacy" className="text-primary hover:underline">
              {t("landing.footer.privacy")}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}