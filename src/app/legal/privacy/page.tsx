import { LegalPage } from "@/components/legal/legal-page";
import { getServerI18n } from "@/lib/i18n/server";

/** Effective date of the published document — bump it when the text changes. */
const EFFECTIVE_DATE = "2026-09-29";

export default async function PrivacyPage() {
  const { t } = await getServerI18n();

  return (
    <LegalPage
      appName={t("app.name")}
      backLabel={t("common.back")}
      title={t("legal.privacy.title")}
      updated={t("legal.updated", { date: EFFECTIVE_DATE })}
      intro={t("legal.privacy.intro")}
      sections={[
        { heading: t("legal.privacy.h1"), body: t("legal.privacy.b1") },
        { heading: t("legal.privacy.h2"), body: t("legal.privacy.b2") },
        { heading: t("legal.privacy.h3"), body: t("legal.privacy.b3") },
        { heading: t("legal.privacy.h4"), body: t("legal.privacy.b4") },
      ]}
    />
  );
}
