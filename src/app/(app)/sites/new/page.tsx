import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/guards";
import { NewSiteWizard } from "@/components/sites/new-site-wizard";

export const metadata: Metadata = { title: "New site" };

export default async function NewSitePage() {
  await requireUser();
  return <NewSiteWizard />;
}
