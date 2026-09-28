import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth/guards";

/** Preview routes are owner-only (same session as the app). */
export default async function PreviewRootLayout({ children }: { children: ReactNode }) {
  await requireUser();
  return <>{children}</>;
}
