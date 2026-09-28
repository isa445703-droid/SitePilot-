import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db/prisma";
import { getServerI18n } from "@/lib/i18n/server";
import { PageHeader } from "@/components/ui/card";
import { AppearanceSettings } from "@/components/settings/appearance-settings";
import {
  AccountSettings,
  AiProviderCard,
  SignOutButton,
} from "@/components/settings/account-settings";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  const { t } = await getServerI18n();

  const membership = await db.orgMember.findFirst({
    where: { userId: user.id },
    include: { organization: true },
    orderBy: { createdAt: "asc" },
  });

  const model = process.env.MISTRAL_MODEL ?? "";
  const configured = Boolean(process.env.MISTRAL_API_KEY);

  return (
    <>
      <PageHeader title={t("settings.title")} description={t("footer.product")} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div>
          <AppearanceSettings />
          <AccountSettings
            user={{ id: user.id, name: user.name, email: user.email }}
            organization={
              membership
                ? { name: membership.organization.name, role: membership.role }
                : null
            }
          />
        </div>

        <div className="space-y-4">
          <AiProviderCard configured={configured} model={model} />

          <div className="card p-4 sm:p-5">
            <h2 className="text-base font-semibold">{t("settings.danger")}</h2>
            <p className="mt-1 text-sm text-muted">{t("auth.logout")}</p>
            <div className="mt-3">
              <SignOutButton />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
