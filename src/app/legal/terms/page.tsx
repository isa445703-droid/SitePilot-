import { LegalPage } from "@/components/legal/legal-page";
import { getServerI18n } from "@/lib/i18n/server";

/** Effective date of the published document — bump it when the text changes. */
const EFFECTIVE_DATE = "2026-09-29";

export default async function TermsPage() {
  const { t } = await getServerI18n();

  return (
    <LegalPage
      appName={t("app.name")}
      backLabel={t("common.back")}
      title={t("legal.terms.title")}
      updated={t("legal.updated", { date: EFFECTIVE_DATE })}
      intro={t("legal.terms.intro")}
      sections={[
        { heading: t("legal.terms.h1"), body: t("legal.terms.b1") },
        { heading: t("legal.terms.h2"), body: t("legal.terms.b2") },
        { heading: t("legal.terms.h3"), body: t("legal.terms.b3") },
        { heading: t("legal.terms.h4"), body: t("legal.terms.b4") },
      ]}
    />
  );
}
