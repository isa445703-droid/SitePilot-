import Link from "next/link";
import { getServerI18n } from "@/lib/i18n/server";

export default async function NotFound() {
  const { t } = await getServerI18n();

  return (
    <div className="grid min-h-dvh place-items-center p-6">
      <div className="card w-full max-w-md p-6 text-center">
        <p className="text-4xl font-black text-accent">404</p>
        <h1 className="mt-2 text-lg font-bold">{t("preview.notFound")}</h1>
        <p className="mt-2 text-sm text-muted">{t("errors.notFound")}</p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link href="/" className="btn btn-primary">
            {t("common.goHome")}
          </Link>
          <Link href="/dashboard" className="btn btn-secondary">
            {t("nav.dashboard")}
          </Link>
        </div>
      </div>
    </div>
  );
}
