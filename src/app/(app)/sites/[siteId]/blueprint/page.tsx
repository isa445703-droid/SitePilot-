import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/guards";
import { getOwnedSite } from "@/lib/auth/guards";
import { getServerI18n } from "@/lib/i18n/server";
import { blueprintSchema, type Blueprint } from "@/lib/ai/schemas";
import { PageHeader } from "@/components/ui/card";
import { BlueprintManager } from "@/components/sites/blueprint-manager";

export const metadata: Metadata = { title: "Blueprint" };

type Params = { params: Promise<{ siteId: string }> };

export default async function BlueprintPage({ params }: Params) {
  const user = await requireUser();
  const { siteId } = await params;
  const site = await getOwnedSite(siteId, user.id);
  const { t } = await getServerI18n();

  let blueprint: Blueprint | null = null;
  if (site?.blueprint) {
    const parsed = blueprintSchema.safeParse(site.blueprint);
    if (parsed.success) blueprint = parsed.data;
  }

  return (
    <>
      <PageHeader title={t("site.tabs.blueprint")} description={t("onboarding.blueprintHelp")} />
      <BlueprintManager
        siteId={siteId}
        initial={blueprint}
        generated={site?.status !== "DRAFT"}
        aiConfigured={Boolean(process.env.MISTRAL_API_KEY)}
      />
    </>
  );
}
