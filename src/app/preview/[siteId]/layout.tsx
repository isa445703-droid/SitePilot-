import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { requireUser, getOwnedSite } from "@/lib/auth/guards";
import { DeviceFrame } from "@/components/preview/device-frame";

type Params = { params: Promise<{ siteId: string }> };

export default async function PreviewSiteLayout({
  children,
  params,
}: Params & { children: ReactNode }) {
  const user = await requireUser();
  const { siteId } = await params;
  const site = await getOwnedSite(siteId, user.id);
  if (!site) notFound();

  return <DeviceFrame siteId={site.id}>{children}</DeviceFrame>;
}
